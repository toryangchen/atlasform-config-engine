import { Module } from "@nestjs/common";
import { DataController } from "./data.controller";
import { DataService } from "./data.service";
import { FormModule } from "../form/form.module";

@Module({
  imports: [FormModule],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService]
})
export class DataModule {}
