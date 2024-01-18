import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from '@config';
import cloudinary from 'cloudinary';
class FilesService {
  private cloudinary = cloudinary.v2;

  constructor() {
    this.cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
  }

  public async uploadToCloudinary({ base64, fileFormat, folder }: { base64: string; fileFormat: string; folder?: string; uploadedBy?: string }) {
    const { uploader } = this.cloudinary;
    const res = await uploader.upload(`data:image/${fileFormat};base64,${base64}`, { folder, image_metadata: true });
    return res;
  }

  public async searchByFolder(folder: string) {
    const { search } = this.cloudinary;
    return await search.expression(`folder=${folder}`).execute();
  }

  public async deleteFileByUrl(targetUrl: string) {
    const { uploader, url, api } = this.cloudinary;
    const publicId = url(targetUrl, { type: 'fetch' }).split('/').slice(-1)[0].split('.')[0];
    const folderName = url(targetUrl, { type: 'fetch' }).split('/').slice(-2, -1)[0];

    let fullPublicId = publicId;
    if (folderName) {
      const { folders } = await api.root_folders();
      if (folders.filter(folder => folder.name === folderName || folder.path === folderName).length > 0) {
        fullPublicId = `${folderName}/${publicId}`;
      }
    }
    return await uploader.destroy(fullPublicId);
  }
}

export default FilesService;
