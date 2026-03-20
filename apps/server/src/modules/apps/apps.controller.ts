import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateAppDataDto } from "./dto/create-app-data.dto";
import { UpdateAppDataDto } from "./dto/update-app-data.dto";
import { AppsService } from "./apps.service";

@Controller("config")
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  listApps() {
    return this.appsService.listApps();
  }

  @Get(":appId/protos/:protoId/forms")
  listFormsByProto(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string
  ) {
    return this.appsService.listFormsByProto(tenantId, appId, protoId);
  }

  @Get(":appId/protos/:protoId/data")
  listDataByProto(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Query("scope") scope?: "active" | "deleted" | "all"
  ) {
    const resolved = scope === "deleted" || scope === "all" ? scope : "active";
    return this.appsService.listDataByProto(tenantId, appId, protoId, resolved);
  }

  @Get(":appId/protos/:protoId/data/unique/:uniqueValue")
  getDataByUniqueKey(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Param("uniqueValue") uniqueValue: string,
    @Query("formName") formName?: string
  ) {
    return this.appsService.getDataByUniqueKey(tenantId, appId, protoId, uniqueValue, formName);
  }

  @Post(":appId/protos/:protoId/data")
  createDataByProto(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Body() body: CreateAppDataDto
  ) {
    return this.appsService.createDataInProto(tenantId, appId, protoId, body);
  }

  @Patch(":appId/protos/:protoId/data/:dataId")
  updateDataByProto(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Param("dataId") dataId: string,
    @Body() body: UpdateAppDataDto
  ) {
    return this.appsService.updateDataInProto(tenantId, appId, protoId, dataId, body);
  }

  @Post(":appId/protos/:protoId/data/:dataId/publish")
  publishDataToPrd(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Param("dataId") dataId: string
  ) {
    return this.appsService.publishDataToPrd(tenantId, appId, protoId, dataId);
  }

  @Delete(":appId/protos/:protoId/data/:dataId")
  removeDataByProto(
    @Headers("x-tenant-id") tenantId = "demo-tenant",
    @Param("appId") appId: string,
    @Param("protoId") protoId: string,
    @Param("dataId") dataId: string
  ) {
    return this.appsService.removeDataInProto(tenantId, appId, protoId, dataId);
  }
}
