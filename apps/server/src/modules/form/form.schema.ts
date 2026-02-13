import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ collection: "forms", timestamps: true })
export class FormEntity {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  appId!: string;

  @Prop({ required: true, index: true })
  formName!: string;

  @Prop({ required: true, index: true })
  version!: string;

  @Prop({ enum: ["draft", "published"], default: "draft", index: true })
  status!: "draft" | "published";

  @Prop({ type: Object, required: true })
  schema!: Record<string, unknown>;
}

export type FormDocument = HydratedDocument<FormEntity>;
export const FormSchema = SchemaFactory.createForClass(FormEntity);
FormSchema.index({ tenantId: 1, appId: 1, formName: 1, version: 1 }, { unique: true });
