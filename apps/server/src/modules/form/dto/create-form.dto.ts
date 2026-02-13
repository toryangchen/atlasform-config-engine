import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class CreateFormDto {
  @IsOptional()
  @IsString()
  appId!: string;

  @IsString()
  formName!: string;

  @IsString()
  version!: string;

  @IsObject()
  schema!: Record<string, unknown>;

  @IsArray()
  fields!: Array<Record<string, unknown>>;
}
