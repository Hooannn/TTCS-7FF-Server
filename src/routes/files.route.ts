import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import FilesController from '@/controllers/files.controller';
import authMiddleware from '@/middlewares/auth.middleware';

class FilesRoute implements Routes {
  public path = '/files';
  public router = Router();
  private filesController = new FilesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/upload/image/single`, authMiddleware, this.filesController.uploadSingleImage);
    this.router.post(`${this.path}/delete/image/single`, authMiddleware, this.filesController.deleteFileByUrl);
    this.router.get(`${this.path}/search/folder`, authMiddleware, this.filesController.searchByFolder);
  }
}

export default FilesRoute;
