import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateAppDataDto {
  @IsOptional()
  @IsString()
  formName?: string;

  @IsObject()
  data!: Record<string, unknown>;
}
