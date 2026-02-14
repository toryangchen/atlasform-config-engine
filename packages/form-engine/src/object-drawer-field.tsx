import React from "react";
import { Button, Drawer, Form, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatPreviewValue, NestedFieldsRenderer, parseNestedFields } from "./nested-fields";

export const ObjectDrawerField: React.FC<{
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  label?: string;
  objectFields?: unknown[];
}> = ({ value, onChange, label, objectFields }) => {
  const [open, setOpen] = React.useState(false);
  const [innerForm] = Form.useForm();
  const nestedFields = React.useMemo(() => parseNestedFields(objectFields), [objectFields]);

  const openDrawer = () => {
    innerForm.setFieldsValue(value ?? {});
    setOpen(true);
  };

  const onSave = async () => {
    const values = (await innerForm.validateFields()) as Record<string, unknown>;
    onChange?.(values);
    setOpen(false);
  };

  const valueSummary = value ? Object.keys(value).length : 0;
  const row = React.useMemo(() => ({ key: "0", ...(value ?? {}) }), [value]);
  const columns = React.useMemo<ColumnsType<Record<string, unknown>>>(() => {
    if (nestedFields.length === 0) {
      return [
        {
          title: "Value",
          key: "value",
          render: () => formatPreviewValue(value)
        }
      ];
    }

    return nestedFields.map((field) => ({
      title: field.label,
      key: field.id,
      render: (_, record) => formatPreviewValue(record[field.id])
    }));
  }, [nestedFields, value]);

  return (
    <>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Typography.Text type="secondary">
            {label ?? "object"}: {valueSummary} keys
          </Typography.Text>
          <Button onClick={openDrawer}>{valueSummary > 0 ? "Edit Object" : "Set Object"}</Button>
        </Space>
        <Table<Record<string, unknown>>
          size="small"
          rowKey="key"
          columns={columns}
          dataSource={value ? [row] : []}
          pagination={false}
          locale={{ emptyText: "No object data yet" }}
        />
      </Space>

      <Drawer
        open={open}
        title={label ?? "Object"}
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
          <Typography.Text type="secondary">No nested fields configured for this object.</Typography.Text>
        ) : (
          <Form form={innerForm} layout="vertical">
            <NestedFieldsRenderer fields={nestedFields} />
          </Form>
        )}
      </Drawer>
    </>
  );
};
