import { Controller, Post, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DevService } from "./dev.service";

@ApiTags("dev")
@Controller("dev")
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Post("seed")
  seed() { return this.devService.seed(); }

  @Post("mock-ingest")
  mockIngest() { return this.devService.mockIngest(); }
}
