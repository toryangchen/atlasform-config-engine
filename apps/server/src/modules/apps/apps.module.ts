import { Module } from "@nestjs/common";
import { AppsController } from "./apps.controller";
import { AppsService } from "./apps.service";
import { DataModule } from "../data/data.module";
import { FormModule } from "../form/form.module";
import { ProtoFormSyncService } from "./proto-form-sync.service";

@Module({
  imports: [FormModule, DataModule],
  controllers: [AppsController],
  providers: [AppsService, ProtoFormSyncService]
})
export class AppsModule {}
