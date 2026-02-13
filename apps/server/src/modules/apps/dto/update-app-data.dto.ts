import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateAppDataDto {
  @IsOptional()
  @IsString()
  formName?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
