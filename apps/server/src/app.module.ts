import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FormModule } from "./modules/form/form.module";
import { DataModule } from "./modules/data/data.module";
import { VersionModule } from "./modules/version/version.module";
import { PluginModule } from "./modules/plugin/plugin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { AppsModule } from "./modules/apps/apps.module";

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/lowcode_platform"),
    FormModule,
    DataModule,
    AppsModule,
    VersionModule,
    PluginModule,
    AuthModule,
    TenantModule
  ]
})
export class AppModule {}
