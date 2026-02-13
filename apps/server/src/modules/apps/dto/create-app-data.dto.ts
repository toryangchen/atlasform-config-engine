import { IsObject, IsString } from "class-validator";

export class CreateAppDataDto {
  @IsString()
  formName!: string;

  @IsString()
  version!: string;

  @IsObject()
  data!: Record<string, unknown>;
}
