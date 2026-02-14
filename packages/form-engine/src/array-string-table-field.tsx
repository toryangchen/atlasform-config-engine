import React from "react";
import { Button, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

interface RowItem {
  key: string;
  index: number;
  value: string;
}

export const ArrayStringTableField: React.FC<{
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const items = value ?? [];
  const idSeqRef = React.useRef(0);
  const [rowIds, setRowIds] = React.useState<string[]>(() => items.map(() => `row-${idSeqRef.current++}`));
  const [draggingKey, setDraggingKey] = React.useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);

  const setItems = (next: string[]) => {
    onChange?.(next);
  };

  React.useEffect(() => {
    setRowIds((prev) => {
      if (prev.length === items.length) return prev;
      if (prev.length > items.length) return prev.slice(0, items.length);

      const next = [...prev];
      for (let i = prev.length; i < items.length; i += 1) {
        next.push(`row-${idSeqRef.current++}`);
      }
      return next;
    });
  }, [items.length]);

  const reorderByIndex = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;

    const nextItems = [...items];
    const movedValue = nextItems[fromIndex]!;
    nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedValue);

    const nextIds = [...rowIds];
    const movedId = nextIds[fromIndex]!;
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, movedId);

    setRowIds(nextIds);
    setItems(nextItems);
  };

  const addRow = () => {
    setRowIds([...rowIds, `row-${idSeqRef.current++}`]);
    setItems([...items, ""]);
  };

  const updateRow = (index: number, nextValue: string) => {
    const next = [...items];
    next[index] = nextValue;
    setItems(next);
  };

  const removeRow = (index: number) => {
    const nextIds = rowIds.filter((_, i) => i !== index);
    setRowIds(nextIds);
    const next = items.filter((_, i) => i !== index);
    setItems(next);
  };

  const rows: RowItem[] = items.map((item, index) => ({ key: rowIds[index] ?? `row-fallback-${index}`, index, value: item }));

  const columns: ColumnsType<RowItem> = [
    {
      title: "",
      key: "drag",
      width: 56,
      render: () => (
        <Typography.Text style={{ cursor: "grab", userSelect: "none" }} aria-label="drag-handle">
          ⋮⋮
        </Typography.Text>
      )
    },
    {
      title: "#",
      dataIndex: "index",
      key: "index",
      width: 64,
      render: (idx: number) => idx + 1
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (_, row) => (
        <Input
          value={row.value}
          placeholder={placeholder ?? "Input string value"}
          onChange={(e) => updateRow(row.index, e.target.value)}
        />
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      render: (_, row) => (
        <Space>
          <Button danger onClick={() => removeRow(row.index)}>
            Delete
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Space style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Text type="secondary">{items.length} item(s)</Typography.Text>
        <Button type="dashed" onClick={addRow}>
          Add Row
        </Button>
      </Space>
      <Table<RowItem>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        onRow={(record) => ({
          draggable: true,
          onDragStart: (event) => {
            setDraggingKey(record.key);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", record.key);
          },
          onDragOver: (event) => {
            event.preventDefault();
            setDragOverKey(record.key);
          },
          onDrop: (event) => {
            event.preventDefault();
            const sourceKey = draggingKey ?? event.dataTransfer.getData("text/plain");
            if (!sourceKey) return;
            const from = rows.findIndex((row) => row.key === sourceKey);
            const to = rows.findIndex((row) => row.key === record.key);
            reorderByIndex(from, to);
            setDraggingKey(null);
            setDragOverKey(null);
          },
          onDragEnd: () => {
            setDraggingKey(null);
            setDragOverKey(null);
          },
          style: {
            cursor: "grab",
            backgroundColor: dragOverKey === record.key ? "rgba(11, 143, 118, 0.08)" : undefined,
            opacity: draggingKey === record.key ? 0.65 : 1
          }
        })}
      />
    </Space>
  );
};
