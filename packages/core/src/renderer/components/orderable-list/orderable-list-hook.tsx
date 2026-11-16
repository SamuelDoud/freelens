import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import React, { ReactElement, useState } from "react";

interface OrderableListHookDependencies {
  children: React.ReactElement[];
  onReorder: (dragIndex: number, releaseIndex: number) => void;
}

const useOrderableListHook = ({ children, onReorder }: OrderableListHookDependencies) => {
  const [items, setItems] = useState<ReactElement[]>(children);
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getItemIds = () => {
    return children.map((child) => child.key!.toString());
  };

  const [itemIds, setItemIds] = useState(getItemIds());

  // The list follows its children, so that a new child shows in the render that got it. An effect
  // would show the old list for one more commit.
  const [syncedChildren, setSyncedChildren] = useState(children);

  if (syncedChildren !== children) {
    setSyncedChildren(children);
    setItems(children);
    setItemIds(getItemIds());
  }

  const onDragStart = (event: DragStartEvent) => {
    const activeIndex = items.findIndex((item) => item.key === event.active.id);
    setActiveId(activeIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    const dragIndex = items.findIndex((item) => item.key === (active.id as string));
    const dropIndex = items.findIndex((item) => item.key === (over?.id as string));

    // A drop outside the list, or on the dragged item itself, changes nothing.
    if (dragIndex < 0 || dropIndex < 0 || dragIndex === dropIndex) {
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(dragIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    setItems(newItems);
    onReorder(dragIndex, dropIndex);
  };

  return {
    items,
    itemIds,
    sensors,
    activeId,
    onDragStart,
    handleDragEnd,
  };
};

export default useOrderableListHook;
