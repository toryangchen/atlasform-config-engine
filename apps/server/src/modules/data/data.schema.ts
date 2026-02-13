import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ collection: "form_data", timestamps: true })
export class FormDataEntity {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  appId!: string;

  @Prop({ required: true, index: true })
  formName!: string;

  @Prop({ required: true, index: true })
  version!: string;

  @Prop({ type: Object, required: true })
  data!: Record<string, unknown>;
}

export type FormDataDocument = HydratedDocument<FormDataEntity>;
export const FormDataSchema = SchemaFactory.createForClass(FormDataEntity);
FormDataSchema.index({ tenantId: 1, appId: 1, formName: 1, version: 1, createdAt: -1 });
