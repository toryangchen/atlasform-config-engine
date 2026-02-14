import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { FormService } from "./form.service";
import { CreateFormDto } from "./dto/create-form.dto";

@Controller("forms")
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  create(@Headers("x-tenant-id") tenantId = "demo-tenant", @Body() body: CreateFormDto) {
    const appId = body.appId || body.formName;
    const schema = {
      ...(body.schema ?? {}),
      formName: (body.schema as any)?.formName ?? body.formName,
      version: (body.schema as any)?.version ?? body.version,
      fields: Array.isArray((body.schema as any)?.fields) ? (body.schema as any).fields : body.fields
    };
    return this.formService.create(tenantId, {
      appId,
      formName: body.formName,
      version: body.version,
      schema
    });
  }

  @Get(":formName")
  getLatest(@Headers("x-tenant-id") tenantId = "demo-tenant", @Param("formName") formName: string) {
    return this.formService.getLatestPublished(tenantId, formName);
  }

  @Get(":formName/:version")
  getByVersion(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("formName") formName: string,
    @Param("version") version: string
  ) {
    return this.formService.getByVersion(tenantId, formName, version);
  }

  @Post(":formName/publish")
  publish(@Headers("x-tenant-id") tenantId = "demo-tenant", @Param("formName") formName: string) {
    return this.formService.publish(tenantId, formName);
  }
}
