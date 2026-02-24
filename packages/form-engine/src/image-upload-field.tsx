import React from "react";
import { Space, Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";

function toUrlArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => Boolean(item));
  }
  return [];
}

function extractUrlFromResponse(response: unknown): string | undefined {
  if (!response) return undefined;
  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>;
      return extractUrlFromResponse(parsed);
    } catch {
      return undefined;
    }
  }
  if (typeof response !== "object") return undefined;
  const data = response as Record<string, unknown>;
  if (typeof data.url === "string" && data.url) return data.url;
  if (data.data && typeof data.data === "object" && typeof (data.data as Record<string, unknown>).url === "string") {
    return (data.data as Record<string, unknown>).url as string;
  }
  return undefined;
}

interface ImageUploadFieldProps {
  value?: string | string[] | undefined;
  onChange?: (value: string | string[] | undefined) => void;
  multiple?: boolean;
  uploadAction?: string | undefined;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ value, onChange, multiple = false, uploadAction = "/api/upload" }) => {
  const [fileList, setFileList] = React.useState<UploadFile[]>([]);

  React.useEffect(() => {
    const urls = toUrlArray(value);
    setFileList((prev) =>
      urls.map((url, index) => {
        const matched = prev.find((item) => item.url === url);
        return (
          matched ?? {
            uid: `url-${index}-${url}`,
            name: url.split("/").pop() || `image-${index + 1}`,
            status: "done",
            url
          }
        );
      })
    );
  }, [value]);

  const emitChange = React.useCallback(
    (nextList: UploadFile[]) => {
      const urls = nextList
        .map((file) => file.url ?? extractUrlFromResponse(file.response))
        .filter((item): item is string => typeof item === "string" && Boolean(item));
      if (multiple) {
        onChange?.(urls);
        return;
      }
      onChange?.(urls[0]);
    },
    [multiple, onChange]
  );

  const onUploadChange: UploadProps["onChange"] = ({ file, fileList: nextList }) => {
    const normalized = nextList.map((item) => {
      const url = item.url ?? extractUrlFromResponse(item.response);
      if (!url) return item;
      return { ...item, url, status: "done" as const };
    });
    setFileList(normalized);
    emitChange(normalized);

    if (file.status === "error") {
      message.error("上传失败，请检查上传接口配置");
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Upload
        listType="picture-card"
        action={uploadAction}
        fileList={fileList}
        multiple={multiple}
        onChange={onUploadChange}
        onRemove={(file) => {
          const next = fileList.filter((item) => item.uid !== file.uid);
          setFileList(next);
          emitChange(next);
          return true;
        }}
      >
        {multiple || fileList.length < 1 ? "+ Upload" : null}
      </Upload>
    </Space>
  );
};

export const SingleImageUploadField: React.FC<{
  value?: string;
  onChange?: (value: string | undefined) => void;
  uploadAction?: string;
}> = ({ value, onChange, uploadAction }) => (
  <ImageUploadField value={value} onChange={(next) => onChange?.(typeof next === "string" ? next : undefined)} multiple={false} uploadAction={uploadAction} />
);

export const MultiImageUploadField: React.FC<{
  value?: string[];
  onChange?: (value: string[]) => void;
  uploadAction?: string;
}> = ({ value, onChange, uploadAction }) => (
  <ImageUploadField
    value={value}
    onChange={(next) => onChange?.(Array.isArray(next) ? next : typeof next === "string" ? [next] : [])}
    multiple
    uploadAction={uploadAction}
  />
);
