import React from "react";
import { Button, Drawer, Form, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatPreviewValue, NestedFieldsRenderer, parseNestedFields } from "./nested-fields";

interface RowItem {
  key: string;
  index: number;
  value: Record<string, unknown>;
}

export const ArrayObjectTableField: React.FC<{
  value?: Array<Record<string, unknown>>;
  onChange?: (value: Array<Record<string, unknown>>) => void;
  objectFields?: unknown[];
  label?: string;
}> = ({ value, onChange, objectFields }) => {
  const items = React.useMemo<Array<Record<string, unknown>>>(() => {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)
      );
    }
    if (value && typeof value === "object") {
      // Backward-compat: old `object` payload is migrated to first row of `array<object>`.
      return [value as Record<string, unknown>];
    }
    return [];
  }, [value]);
  const [innerForm] = Form.useForm();
  const idSeqRef = React.useRef(0);
  const [rowIds, setRowIds] = React.useState<string[]>(() => items.map(() => `obj-row-${idSeqRef.current++}`));
  const [open, setOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draggingKey, setDraggingKey] = React.useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);
  const nestedFields = React.useMemo(() => parseNestedFields(objectFields), [objectFields]);

  const setItems = (next: Array<Record<string, unknown>>) => {
    onChange?.(next);
  };

  React.useEffect(() => {
    setRowIds((prev) => {
      if (prev.length === items.length) return prev;
      if (prev.length > items.length) return prev.slice(0, items.length);
      const next = [...prev];
      for (let i = prev.length; i < items.length; i += 1) {
        next.push(`obj-row-${idSeqRef.current++}`);
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

  const openNew = () => {
    setEditingIndex(null);
    innerForm.resetFields();
    setOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    innerForm.setFieldsValue(items[index] ?? {});
    setOpen(true);
  };

  const removeRow = (index: number) => {
    setRowIds((prev) => prev.filter((_, i) => i !== index));
    setItems(items.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    const values = (await innerForm.validateFields()) as Record<string, unknown>;
    if (editingIndex === null) {
      setRowIds((prev) => [...prev, `obj-row-${idSeqRef.current++}`]);
      setItems([...items, values]);
    } else {
      const next = [...items];
      next[editingIndex] = values;
      setItems(next);
    }
    innerForm.resetFields();
    setOpen(false);
  };

  const rows: RowItem[] = items.map((item, index) => ({ key: rowIds[index] ?? `obj-fallback-${index}`, index, value: item }));
  const objectColumns: ColumnsType<RowItem> =
    nestedFields.length > 0
      ? nestedFields.map((field) => ({
          title: field.label,
          key: field.id,
          render: (_, row) => formatPreviewValue(row.value[field.id])
        }))
      : [
          {
            title: "Object",
            key: "object",
            render: (_, row) => formatPreviewValue(row.value)
          }
        ];

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
    ...objectColumns,
    {
      title: "Actions",
      key: "actions",
      width: 170,
      render: (_, row) => (
        <Space>
          <Button onClick={() => openEdit(row.index)}>Edit</Button>
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
        <Button type="dashed" onClick={openNew}>
          Add Row
        </Button>
      </Space>
      <Table<RowItem>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "No object rows yet" }}
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

      <Drawer
        open={open}
        title={editingIndex === null ? "Add Object Row" : "Edit Object Row"}
        width={560}
        onClose={() => setOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={() => void onSave()}>
              Save
            </Button>
          </Space>
        }
      >
        {nestedFields.length === 0 ? (
          <Typography.Text type="secondary">No object fields configured for this array.</Typography.Text>
        ) : (
          <Form form={innerForm} layout="vertical">
            <NestedFieldsRenderer fields={nestedFields} />
          </Form>
        )}
      </Drawer>
    </Space>
  );
};
