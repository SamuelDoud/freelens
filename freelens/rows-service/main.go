package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"runtime"
	"runtime/debug"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	authorizationv1 "k8s.io/api/authorization/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

type server struct {
	mu       sync.Mutex
	rows     map[types.UID]*Row // current
	sent     map[types.UID]*Row // what subscribers know
	touched  map[types.UID]struct{}
	nextID   uint32
	seq      uint64
	subs     map[*subscriber]struct{}
	flushLen int // batches
	// stats
	events                                     atomic.Int64
	noops                                      atomic.Int64
	bytesPatch, bytesFullRow, msgs, batchesOut atomic.Int64
	subMu                                      sync.Mutex
	stash                                      map[types.UID]*Row
	ready                                      chan struct{} // closed once the informer has synced
}

func newServer() *server {
	return &server{rows: map[types.UID]*Row{}, sent: map[types.UID]*Row{}, touched: map[types.UID]struct{}{}, subs: map[*subscriber]struct{}{}, stash: map[types.UID]*Row{}}
}

// subscriber is one /rows/watch stream. A reader that falls behind by more than the buffer has
// its stream ended (overflow closes) rather than losing batches: it then loads the rows again.
type subscriber struct {
	ch       chan []byte
	overflow chan struct{}
}

func (s *server) upsert(p *corev1.Pod) {
	var r Row
	s.mu.Lock()
	defer s.mu.Unlock()
	if st, ok := s.stash[p.UID]; ok {
		r = *st
		delete(s.stash, p.UID)
	} else {
		r = computeRow(p)
	}
	s.events.Add(1)
	if old, ok := s.rows[p.UID]; ok {
		r.ID = old.ID
	} else {
		s.nextID++
		r.ID = s.nextID
	}
	s.rows[p.UID] = &r
	s.touched[p.UID] = struct{}{}
}

func (s *server) remove(p *corev1.Pod) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events.Add(1)
	// The transform also computed a row for the object of the delete event: drop it.
	delete(s.stash, p.UID)
	delete(s.rows, p.UID)
	s.touched[p.UID] = struct{}{}
}

// flush turns the touched set into one delta message.
func (s *server) flush() {
	s.mu.Lock()
	if len(s.touched) == 0 {
		s.mu.Unlock()
		return
	}
	var adds, chg, del []byte
	na, nc, nd := 0, 0, 0
	var fullAlt int64
	for uid := range s.touched {
		cur, now := s.rows[uid]
		old, was := s.sent[uid]
		switch {
		case now && !was:
			if na > 0 {
				adds = append(adds, ',')
			}
			adds = cur.JSON(adds)
			na++
			s.sent[uid] = cur
		case !now && was:
			if nd > 0 {
				del = append(del, ',')
			}
			del = strconv.AppendUint(del, uint64(old.ID), 10)
			nd++
			delete(s.sent, uid)
		case now && was:
			idx := diffCols(old, cur)
			if len(idx) == 0 {
				s.noops.Add(1)
				continue
			}
			if nc > 0 {
				chg = append(chg, ',')
			}
			chg = append(chg, '[')
			chg = strconv.AppendUint(chg, uint64(cur.ID), 10)
			for _, i := range idx {
				chg = append(chg, ',')
				chg = strconv.AppendInt(chg, int64(i), 10)
				chg = append(chg, ',')
				chg = cur.cell(chg, i)
			}
			chg = append(chg, ']')
			fullAlt += int64(len(cur.JSON(nil))) + 2
			nc++
			s.sent[uid] = cur
		}
	}
	s.touched = map[types.UID]struct{}{}
	if na+nc+nd == 0 {
		s.mu.Unlock()
		return
	}
	s.seq++
	msg := []byte(`{"s":` + strconv.FormatUint(s.seq, 10) + `,"a":[`)
	msg = append(msg, adds...)
	msg = append(msg, `],"c":[`...)
	msg = append(msg, chg...)
	msg = append(msg, `],"d":[`...)
	msg = append(msg, del...)
	msg = append(msg, "]}\n"...)
	s.mu.Unlock()
	s.msgs.Add(1)
	s.bytesPatch.Add(int64(len(msg)))
	s.bytesFullRow.Add(int64(len(msg)) - int64(len(chg)) + fullAlt)
	s.subMu.Lock()
	for sub := range s.subs {
		select {
		case sub.ch <- msg:
		default:
			delete(s.subs, sub)
			close(sub.overflow)
		}
	}
	s.subMu.Unlock()
}

func (s *server) rowsJSON() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := make([]byte, 0, len(s.rows)*220)
	b = append(b, `{"seq":`...)
	b = strconv.AppendUint(b, s.seq, 10)
	b = append(b, `,"cols":[`...)
	for i, c := range columnNames {
		if i > 0 {
			b = append(b, ',')
		}
		b = appendStr(b, c)
	}
	b = append(b, `],"rows":[`...)
	first := true
	for _, r := range s.rows {
		if !first {
			b = append(b, ',')
		}
		first = false
		b = r.JSON(b)
	}
	return append(b, "]}"...)
}

// authorized checks the per-process token that Freelens's main process adds to every request it
// forwards, so that another local process cannot read the rows from the loopback port.
func authorized(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token != "" && subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Rows-Token")), []byte(token)) != 1 {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) serve(ln net.Listener, token string, storeLen func() int) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rows", func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-s.ready:
		case <-r.Context().Done():
			return
		}
		b := s.rowsJSON()
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	})
	mux.HandleFunc("/rows/watch", func(w http.ResponseWriter, r *http.Request) {
		sub := &subscriber{ch: make(chan []byte, 256), overflow: make(chan struct{})}
		s.subMu.Lock()
		s.subs[sub] = struct{}{}
		s.subMu.Unlock()
		defer func() { s.subMu.Lock(); delete(s.subs, sub); s.subMu.Unlock() }()
		w.Header().Set("Content-Type", "application/x-ndjson")
		fl := w.(http.Flusher)
		fl.Flush()
		for {
			select {
			case m := <-sub.ch:
				w.Write(m)
				fl.Flush()
			case <-sub.overflow:
				log.Printf("a /rows/watch reader fell behind; ending its stream so that it loads the rows again")
				return
			case <-r.Context().Done():
				return
			}
		}
	})
	mux.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("gc") == "1" {
			runtime.GC()
			debug.FreeOSMemory()
		}
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		s.mu.Lock()
		n := len(s.rows)
		s.mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{
			"rows": n, "cached": storeLen(), "heapAlloc": m.HeapAlloc, "heapInuse": m.HeapInuse, "sys": m.Sys,
			"events": s.events.Load(), "noopEvents": s.noops.Load(), "msgs": s.msgs.Load(),
			"deltaBytes": s.bytesPatch.Load(), "deltaBytesIfFullRowsForChanges": s.bytesFullRow.Load(),
		})
	})
	go func() {
		t := time.NewTicker(100 * time.Millisecond)
		for range t.C {
			s.flush()
		}
	}()
	log.Fatal(http.Serve(ln, authorized(token, mux)))
}

// accessDeniedExitCode tells Freelens that this cluster cannot use the service: its lists then load
// full objects, which also work with access to some namespaces only.
const accessDeniedExitCode = 3

// mayListAndWatchAllPods asks the API server whether the user may list and watch pods in every
// namespace, which the cluster-wide informer needs. When the question itself fails, it answers yes:
// the informer then reports the real error.
func mayListAndWatchAllPods(cs kubernetes.Interface) bool {
	for _, verb := range []string{"list", "watch"} {
		review := &authorizationv1.SelfSubjectAccessReview{
			Spec: authorizationv1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &authorizationv1.ResourceAttributes{Verb: verb, Resource: "pods"},
			},
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		answer, err := cs.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
		cancel()
		if err != nil {
			log.Printf("access review for %s pods failed: %v", verb, err)
			return true
		}
		if !answer.Status.Allowed {
			return false
		}
	}
	return true
}

func main() {
	// The connection comes from the environment, not from arguments, so that the token is not in the
	// process list: the URL of the app's local proxy for this cluster, its certificate (base64 PEM)
	// and the bearer token that proxy requires.
	server := os.Getenv("ROWS_SERVER")
	caData, _ := base64.StdEncoding.DecodeString(os.Getenv("ROWS_CA_DATA"))
	bearer := os.Getenv("ROWS_BEARER_TOKEN")
	token := os.Getenv("ROWS_SERVICE_TOKEN")
	if server == "" {
		log.Fatal("ROWS_SERVER is not set")
	}
	internOn = true

	// The parent keeps our stdin open; when it exits, or closes the pipe, so do we.
	go func() {
		io.Copy(io.Discard, os.Stdin)
		os.Exit(0)
	}()

	s := newServer()
	// Rows-only cache: the row is computed as the object enters the informer, and only a stub is kept.
	// A transform must be idempotent, which Generation == -1 marks.
	transform := func(o any) (any, error) {
		p, ok := o.(*corev1.Pod)
		if !ok {
			return o, nil
		}
		if p.Generation == -1 {
			return p, nil
		}
		r := computeRow(p)
		s.mu.Lock()
		s.stash[p.UID] = &r
		s.mu.Unlock()
		return &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: p.Name, Namespace: p.Namespace, UID: p.UID, ResourceVersion: p.ResourceVersion, Generation: -1}}, nil
	}

	cfg := &rest.Config{
		Host:            server,
		BearerToken:     bearer,
		TLSClientConfig: rest.TLSClientConfig{CAData: caData},
		QPS:             -1,
		Burst:           -1,
		UserAgent:       "freelens-rows",
		// The API server is asked for Protobuf, which is smaller and cheaper to decode than JSON.
		ContentConfig: rest.ContentConfig{
			ContentType:        "application/vnd.kubernetes.protobuf",
			AcceptContentTypes: "application/vnd.kubernetes.protobuf,application/json",
		},
	}
	cs := kubernetes.NewForConfigOrDie(cfg)
	if !mayListAndWatchAllPods(cs) {
		log.Printf("the user may not list and watch pods in every namespace")
		os.Exit(accessDeniedExitCode)
	}
	lw := cache.NewListWatchFromClient(cs.CoreV1().RESTClient(), "pods", metav1.NamespaceAll, fields.Everything())
	inf := cache.NewSharedIndexInformer(lw, &corev1.Pod{}, 0, cache.Indexers{})
	inf.SetTransform(transform)
	inf.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(o any) { s.upsert(o.(*corev1.Pod)) },
		UpdateFunc: func(_, o any) { s.upsert(o.(*corev1.Pod)) },
		DeleteFunc: func(o any) {
			if t, ok := o.(cache.DeletedFinalStateUnknown); ok {
				o = t.Obj
			}
			s.remove(o.(*corev1.Pod))
		},
	})

	// Listen first, so the parent gets the port at once: until the informer has synced, /rows waits.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	synced := make(chan struct{})
	s.ready = synced
	go func() {
		go inf.Run(make(chan struct{}))
		cache.WaitForCacheSync(make(chan struct{}), inf.HasSynced)
		time.Sleep(300 * time.Millisecond)
		s.flush()
		log.Printf("synced: %d pods", len(s.rows))
		close(synced)
	}()
	fmt.Printf("freelens-rows listening on %s\n", ln.Addr().String())
	s.serve(ln, token, func() int { return len(inf.GetStore().List()) })
}
