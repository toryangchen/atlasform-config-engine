import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateAppDataDto } from "./dto/create-app-data.dto";
import { UpdateAppDataDto } from "./dto/update-app-data.dto";
import { AppsService } from "./apps.service";

@Controller("apps")
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  listApps() {
    return this.appsService.listApps();
  }

  @Get(":appId/forms")
  listFormsByApp(@Headers("x-tenant-id") tenantId = "demo-tenant", @Param("appId") appId: string) {
    return this.appsService.listFormsByApp(tenantId, appId);
  }

  @Get(":appId/data")
  listDataByApp(@Headers("x-tenant-id") tenantId = "demo-tenant", @Param("appId") appId: string) {
    return this.appsService.listDataByApp(tenantId, appId);
  }

  @Get(":appId/data/unique/:uniqueValue")
  getDataByUniqueKey(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("uniqueValue") uniqueValue: string,
    @Query("formName") formName?: string
  ) {
    return this.appsService.getDataByUniqueKey(tenantId, appId, uniqueValue, formName);
  }

  @Post(":appId/data")
  createDataByApp(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Body() body: CreateAppDataDto
  ) {
    return this.appsService.createDataInApp(tenantId, appId, body);
  }

  @Patch(":appId/data/:dataId")
  updateDataByApp(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("dataId") dataId: string,
    @Body() body: UpdateAppDataDto
  ) {
    return this.appsService.updateDataInApp(tenantId, appId, dataId, body);
  }

  @Delete(":appId/data/:dataId")
  removeDataByApp(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("dataId") dataId: string
  ) {
    return this.appsService.removeDataInApp(tenantId, appId, dataId);
  }
}
