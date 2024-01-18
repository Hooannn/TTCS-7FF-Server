import { errorStatus } from '@/config';
import { HttpException } from '@/exceptions/HttpException';
import FilesService from '@/services/files.service';
import { bufferToDataURI } from '@/utils/file';
import { NextFunction, Request, Response } from 'express';
class FilesController {
  private filesService = new FilesService();

  public uploadSingleImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files;
      if (!files.length) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const folder = req.body.folder || req.query.folder?.toString();
      const file = files[0];
      const fileFormat = file.mimetype.split('/')[1];
      const { base64 } = bufferToDataURI(fileFormat, file.buffer);
      const data = await this.filesService.uploadToCloudinary({ base64, fileFormat, folder });
      res.status(201).json({ code: 201, success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public searchByFolder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folder } = req.query;
      if (!folder) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const data = await this.filesService.searchByFolder(folder.toString());
      res.status(200).json({ code: 200, success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public deleteFileByUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body;
      if (!url) throw new HttpException(400, errorStatus.BAD_REQUEST);
      const data = await this.filesService.deleteFileByUrl(url.toString());
      res.status(200).json({ code: 200, success: true, data });
    } catch (error) {
      next(error);
    }
  };
}

export default FilesController;
