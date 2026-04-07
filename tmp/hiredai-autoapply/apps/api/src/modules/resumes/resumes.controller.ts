import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, Request, UseInterceptors, UploadedFile, Query
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ResumesService } from "./resumes.service";
import { UpdateResumeDto } from "./dto/update-resume.dto";

@ApiTags("resumes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("resumes")
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: "./uploads",
      filename: (_, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      if ([".pdf", ".doc", ".docx"].includes(extname(file.originalname).toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF and Word files allowed"), false);
      }
    },
  }))
  upload(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Query("title") title: string,
    @Query("roleTag") roleTag?: string,
  ) {
    return this.resumesService.upload(req.user.id, file, title ?? file.originalname, roleTag);
  }

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.resumesService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.resumesService.findOne(req.user.id, id);
  }

  @Patch(":id")
  update(
    @Request() req: { user: { id: string } },
    @Param("id") id: string,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.resumesService.update(req.user.id, id, dto);
  }

  @Delete(":id")
  remove(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.resumesService.remove(req.user.id, id);
  }
}
