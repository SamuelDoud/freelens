// Copyright (c) Freelens Authors. All rights reserved.
// Licensed under MIT License. See LICENSE in root directory for more information.

package main

import (
	"encoding/json"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func pod(uid, name string) *corev1.Pod {
	return &corev1.Pod{ObjectMeta: metav1.ObjectMeta{UID: types.UID(uid), Name: name, Namespace: "default"}}
}

type delta struct {
	S uint64            `json:"s"`
	A []json.RawMessage `json:"a"`
	C []json.RawMessage `json:"c"`
	D []uint32          `json:"d"`
}

func receive(t *testing.T, sub *subscriber) delta {
	t.Helper()
	select {
	case m := <-sub.ch:
		var d delta
		if err := json.Unmarshal(m, &d); err != nil {
			t.Fatalf("batch is not JSON: %v: %s", err, m)
		}
		return d
	default:
		t.Fatal("no batch was sent")
		return delta{}
	}
}

func TestFlushSendsAddsChangesAndDeletesWithIncreasingSequence(t *testing.T) {
	s := newServer()
	sub := &subscriber{ch: make(chan []byte, 8), overflow: make(chan struct{})}
	s.subs[sub] = struct{}{}

	s.upsert(pod("a", "one"))
	s.upsert(pod("b", "two"))
	s.flush()
	first := receive(t, sub)
	if first.S != 1 || len(first.A) != 2 {
		t.Fatalf("first batch: want seq 1 with 2 adds, got %+v", first)
	}

	changed := pod("a", "one")
	changed.Spec.NodeName = "node-1"
	s.upsert(changed)
	s.remove(pod("b", "two"))
	s.flush()
	second := receive(t, sub)
	if second.S != 2 || len(second.C) != 1 || len(second.D) != 1 {
		t.Fatalf("second batch: want seq 2 with 1 change and 1 delete, got %+v", second)
	}

	s.upsert(changed)
	s.flush()
	select {
	case m := <-sub.ch:
		t.Fatalf("an update that changes no column sent a batch: %s", m)
	default:
	}
}

func TestReaderThatFallsBehindHasItsStreamEnded(t *testing.T) {
	s := newServer()
	slow := &subscriber{ch: make(chan []byte, 1), overflow: make(chan struct{})}
	s.subs[slow] = struct{}{}

	s.upsert(pod("a", "one"))
	s.flush()
	s.upsert(pod("b", "two"))
	s.flush() // the buffer of one is full: this batch would be lost

	select {
	case <-slow.overflow:
	default:
		t.Fatal("the stream of a reader that fell behind was not ended")
	}
	if _, still := s.subs[slow]; still {
		t.Fatal("the reader that fell behind is still subscribed")
	}
}

func TestRemoveDropsTheRowTheTransformComputed(t *testing.T) {
	s := newServer()
	r := computeRow(pod("gone", "x"))
	s.stash["gone"] = &r // what the informer's transform does for a delete event
	s.remove(pod("gone", "x"))
	if len(s.stash) != 0 {
		t.Fatalf("the transform's row of a deleted pod stayed: %d left", len(s.stash))
	}
}
