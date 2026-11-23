package main

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
)

// Row is one pod list line: exactly the columns of the Freelens pods list.
type Row struct {
	ID         uint32
	Name       string
	Namespace  string
	Containers []ContainerCell
	Restarts   int64
	Owners     [][2]string // kind, name
	Node       string
	QoS        string
	Created    int64 // epoch ms
	Status     string
	CPUReq     *float64
	CPULim     *float64
	MemReq     *float64
	MemLim     *float64
	// OverviewStatus is what Pod.getStatus() of Freelens answers: the status the Workloads
	// overview counts, which differs from the Status column (a Running pod that is not Ready
	// counts as Pending there).
	OverviewStatus string
}

type ContainerCell struct{ Name, Class, Detail string }

var columnNames = []string{"id", "name", "namespace", "containers", "restarts", "owners", "node", "qos", "created", "status", "cpuRequest", "cpuLimit", "memoryRequest", "memoryLimit", "overviewStatus"}

// ---- quantity: exact port of parseQuantity in k8s-quantity.ts ----
var qtyRe = regexp.MustCompile(`^([+-]?(?:\d+\.?\d*|\.\d+))(?:[eE]([+-]?\d+))?(n|u|m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)?$`)
var suffixes = map[string]float64{"n": 1e-9, "u": 1e-6, "m": 1e-3, "": 1, "k": 1e3, "M": 1e6, "G": 1e9, "T": 1e12, "P": 1e15, "E": 1e18,
	"Ki": 1 << 10, "Mi": 1 << 20, "Gi": 1 << 30, "Ti": 1 << 40, "Pi": 1 << 50, "Ei": 1 << 60}

func parseQuantity(s string) *float64 {
	m := qtyRe.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return nil
	}
	d, _ := strconv.ParseFloat(m[1], 64)
	e := 0.0
	if m[2] != "" {
		e, _ = strconv.ParseFloat(m[2], 64)
	}
	v := d * math.Pow(10, e) * suffixes[m[3]]
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return nil
	}
	return &v
}

func qty(rl corev1.ResourceList, name corev1.ResourceName) *float64 {
	q, ok := rl[name]
	if !ok {
		return nil
	}
	return parseQuantity(q.String())
}

type amounts [4]*float64 // cpuReq, cpuLim, memReq, memLim

func amountsOf(c *corev1.Container) amounts {
	return amounts{qty(c.Resources.Requests, "cpu"), qty(c.Resources.Limits, "cpu"), qty(c.Resources.Requests, "memory"), qty(c.Resources.Limits, "memory")}
}

func podAmount(containers, inits []corev1.Container, ca, ia []amounts, slot int, overhead float64) *float64 {
	isLimit := slot == 1 || slot == 3
	count := len(containers) + len(inits)
	undef := 0
	for i := range containers {
		if ca[i][slot] == nil {
			undef++
		}
	}
	for i := range inits {
		if ia[i][slot] == nil {
			undef++
		}
	}
	if (isLimit && undef > 0) || (!isLimit && undef == count) {
		return nil
	}
	sidecars, initPeak := 0.0, 0.0
	for i := range inits {
		a := 0.0
		if ia[i][slot] != nil {
			a = *ia[i][slot]
		}
		if inits[i].RestartPolicy != nil && *inits[i].RestartPolicy == corev1.ContainerRestartPolicyAlways {
			sidecars += a
		} else {
			initPeak = math.Max(initPeak, sidecars+a)
		}
	}
	running := sidecars
	for i := range containers {
		if ca[i][slot] != nil {
			running += *ca[i][slot]
		}
	}
	v := math.Max(running, initPeak) + overhead
	return &v
}

func computeResources(p *corev1.Pod) (a [4]*float64) {
	cs, is := p.Spec.Containers, p.Spec.InitContainers
	ca := make([]amounts, len(cs))
	ia := make([]amounts, len(is))
	for i := range cs {
		ca[i] = amountsOf(&cs[i])
	}
	for i := range is {
		ia[i] = amountsOf(&is[i])
	}
	cpuO, memO := 0.0, 0.0
	if v := qty(p.Spec.Overhead, "cpu"); v != nil {
		cpuO = *v
	}
	if v := qty(p.Spec.Overhead, "memory"); v != nil {
		memO = *v
	}
	for slot := 0; slot < 4; slot++ {
		o := cpuO
		if slot >= 2 {
			o = memO
		}
		a[slot] = podAmount(cs, is, ca, ia, slot, o)
	}
	return
}

func stateName(s corev1.ContainerState) string {
	switch {
	case s.Running != nil:
		return "running"
	case s.Waiting != nil:
		return "waiting"
	case s.Terminated != nil:
		return "terminated"
	}
	return ""
}

func allStatuses(p *corev1.Pod) []corev1.ContainerStatus {
	s := make([]corev1.ContainerStatus, 0, len(p.Status.ContainerStatuses)+len(p.Status.InitContainerStatuses)+len(p.Status.EphemeralContainerStatuses))
	s = append(s, p.Status.ContainerStatuses...)
	s = append(s, p.Status.InitContainerStatuses...)
	return append(s, p.Status.EphemeralContainerStatuses...)
}

var internMu sync.Mutex
var internMap = map[string]string{}
var internOn = true

// in returns one shared copy of a low-cardinality string (class, detail, node, qos, status, kind...).
func in(s string) string {
	if !internOn {
		return s
	}
	internMu.Lock()
	defer internMu.Unlock()
	if v, ok := internMap[s]; ok {
		return v
	}
	internMap[s] = s
	return s
}

func computeRow(p *corev1.Pod) Row {
	r := Row{Name: p.Name, Namespace: in(p.Namespace), Node: in(p.Spec.NodeName), QoS: in(string(p.Status.QOSClass))}
	// restarts: containerStatuses only
	for _, cs := range p.Status.ContainerStatuses {
		r.Restarts += int64(cs.RestartCount)
	}
	for _, o := range p.OwnerReferences {
		r.Owners = append(r.Owners, [2]string{in(o.Kind), o.Name})
	}
	r.Created = p.CreationTimestamp.Time.UnixMilli()
	if p.CreationTimestamp.IsZero() {
		r.Created = time.Now().UnixMilli()
	}
	// status message
	statuses := allStatuses(p)
	switch {
	case p.Status.Reason == "Evicted":
		r.Status = "Evicted"
	case p.DeletionTimestamp != nil && anyRunningOrWaiting(statuses):
		r.Status = "Terminating"
	case p.DeletionTimestamp != nil && len(p.Finalizers) > 0:
		r.Status = "Finalizing"
	default:
		r.Status = string(p.Status.Phase)
		if r.Status == "" {
			r.Status = "Waiting"
		}
		r.Status = in(r.Status)
	}
	r.OverviewStatus = overviewStatus(p)
	// containers
	type typed struct {
		c    *corev1.Container
		eph  *corev1.EphemeralContainer
		kind int // 0 containers, 1 init, 2 ephemeral
		name string
	}
	var all []typed
	for i := range p.Spec.Containers {
		all = append(all, typed{c: &p.Spec.Containers[i], kind: 0, name: p.Spec.Containers[i].Name})
	}
	for i := range p.Spec.InitContainers {
		all = append(all, typed{c: &p.Spec.InitContainers[i], kind: 1, name: p.Spec.InitContainers[i].Name})
	}
	for i := range p.Spec.EphemeralContainers {
		all = append(all, typed{eph: &p.Spec.EphemeralContainers[i], kind: 2, name: p.Spec.EphemeralContainers[i].Name})
	}
	defName := ""
	if len(all) > 0 {
		defName = all[0].name
		if a := p.Annotations["kubectl.kubernetes.io/default-container"]; a != "" {
			for _, t := range all {
				if t.name == a {
					defName = a
					break
				}
			}
		}
	}
	for _, t := range all {
		var st *corev1.ContainerStatus
		for i := range statuses {
			if statuses[i].Name == t.name {
				st = &statuses[i]
				break
			}
		}
		state, last := "", ""
		if st != nil {
			state, last = stateName(st.State), stateName(st.LastTerminationState)
		}
		var cls string
		switch {
		case state == "terminated":
			cls = "terminated"
		case t.kind == 2 && last == "terminated":
			cls = "terminated"
		case t.kind == 2:
			cls = "container-ephemeral"
		case st != nil && st.Ready && st.RestartCount > 0:
			cls = "restarted"
		case st != nil && st.Ready:
			cls = "running"
		case state == "running":
			cls = "waiting"
		default:
			cls = state
		}
		detail := ""
		if state != "" {
			var b strings.Builder
			b.WriteString(state)
			if t.kind == 1 {
				b.WriteString(", init")
			}
			if t.kind == 2 {
				b.WriteString(", ephemeral")
			}
			if st.RestartCount > 0 {
				b.WriteString(", restarted")
			}
			if st.Ready {
				b.WriteString(", ready")
			}
			if t.name == defName {
				b.WriteString(", default")
			}
			if tm := st.State.Terminated; tm != nil {
				reason := tm.Reason
				if reason == "" {
					reason = "undefined" // the TS template prints an absent reason as "undefined"
				}
				b.WriteString(" - " + reason + " (exit code: " + strconv.Itoa(int(tm.ExitCode)) + ")")
			}
			detail = b.String()
		}
		r.Containers = append(r.Containers, ContainerCell{in(t.name), in(cls), in(detail)})
	}
	a := computeResources(p)
	r.CPUReq, r.CPULim, r.MemReq, r.MemLim = a[0], a[1], a[2], a[3]
	return r
}

func anyRunningOrWaiting(s []corev1.ContainerStatus) bool {
	for _, c := range s {
		if c.State.Running != nil || c.State.Waiting != nil {
			return true
		}
	}
	return false
}

// ---- JSON encoding (hand-rolled, compact) ----
func appendStr(b []byte, s string) []byte {
	b = append(b, '"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c == '"' || c == '\\':
			b = append(b, '\\', c)
		case c < 0x20:
			b = append(b, '\\', 'u', '0', '0', "0123456789abcdef"[c>>4], "0123456789abcdef"[c&15])
		default:
			b = append(b, c)
		}
	}
	return append(b, '"')
}

func appendNum(b []byte, v *float64) []byte {
	if v == nil {
		return append(b, "null"...)
	}
	return strconv.AppendFloat(b, *v, 'f', -1, 64)
}

// cell appends the JSON of column i.
func (r *Row) cell(b []byte, i int) []byte {
	switch i {
	case 0:
		return strconv.AppendUint(b, uint64(r.ID), 10)
	case 1:
		return appendStr(b, r.Name)
	case 2:
		return appendStr(b, r.Namespace)
	case 3:
		b = append(b, '[')
		for j, c := range r.Containers {
			if j > 0 {
				b = append(b, ',')
			}
			b = append(b, '[')
			b = appendStr(b, c.Name)
			b = append(b, ',')
			b = appendStr(b, c.Class)
			b = append(b, ',')
			b = appendStr(b, c.Detail)
			b = append(b, ']')
		}
		return append(b, ']')
	case 4:
		return strconv.AppendInt(b, r.Restarts, 10)
	case 5:
		b = append(b, '[')
		for j, o := range r.Owners {
			if j > 0 {
				b = append(b, ',')
			}
			b = append(b, '[')
			b = appendStr(b, o[0])
			b = append(b, ',')
			b = appendStr(b, o[1])
			b = append(b, ']')
		}
		return append(b, ']')
	case 6:
		return appendStr(b, r.Node)
	case 7:
		return appendStr(b, r.QoS)
	case 8:
		return strconv.AppendInt(b, r.Created, 10)
	case 9:
		return appendStr(b, r.Status)
	case 10:
		return appendNum(b, r.CPUReq)
	case 11:
		return appendNum(b, r.CPULim)
	case 12:
		return appendNum(b, r.MemReq)
	case 13:
		return appendNum(b, r.MemLim)
	default:
		return appendStr(b, r.OverviewStatus)
	}
}

func (r *Row) JSON(b []byte) []byte {
	b = append(b, '[')
	for i := 0; i < len(columnNames); i++ {
		if i > 0 {
			b = append(b, ',')
		}
		b = r.cell(b, i)
	}
	return append(b, ']')
}

// diff returns the indexes of the columns whose JSON differs (id excluded).
func diffCols(a, b *Row) (idx []int) {
	var x, y []byte
	for i := 1; i < len(columnNames); i++ {
		x = a.cell(x[:0], i)
		y = b.cell(y[:0], i)
		if string(x) != string(y) {
			idx = append(idx, i)
		}
	}
	return
}

// overviewStatus ports Pod.getStatus() of packages/kube-object/src/specifics/pod.ts.
func overviewStatus(p *corev1.Pod) string {
	switch {
	case p.Status.Reason == "Evicted":
		return "Evicted"
	case p.Status.Phase == corev1.PodFailed:
		return "Failed"
	case p.Status.Phase == corev1.PodSucceeded:
		return "Succeeded"
	case p.Status.Phase == corev1.PodRunning && isReady(p):
		return "Running"
	}
	return "Pending"
}

func isReady(p *corev1.Pod) bool {
	for _, c := range p.Status.Conditions {
		if c.Type == corev1.PodReady && c.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}
