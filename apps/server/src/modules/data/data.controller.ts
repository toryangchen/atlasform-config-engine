import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { DataService } from "./data.service";

@Controller("data")
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post(":formName")
  createLatest(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("formName") formName: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.dataService.create(tenantId, formName, data);
  }

  @Post(":formName/:version")
  create(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("formName") formName: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.dataService.create(tenantId, formName, data);
  }

  @Get(":formName")
  listByForm(@Headers("x-tenant-id") tenantId = "demo-tenant", @Param("formName") formName: string) {
    return this.dataService.listByForm(tenantId, formName);
  }
}
