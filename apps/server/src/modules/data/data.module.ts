import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DataController } from "./data.controller";
import { DataService } from "./data.service";
import { FormModule } from "../form/form.module";
import { FormDataEntity, FormDataSchema } from "./data.schema";

@Module({
  imports: [FormModule, MongooseModule.forFeature([{ name: FormDataEntity.name, schema: FormDataSchema }])],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService]
})
export class DataModule {}
