import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'raw';

/** Uploaded as `type: 'authenticated'` — the asset has no public URL of its
 * own, so a delivery link only resolves with a signature this service
 * generates. Downloads still go entirely through AssignmentsController's
 * existing assertMayView() check; Cloudinary is just where the bytes live. */
@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  resourceTypeForMime(mimeType: string): CloudinaryResourceType {
    return mimeType.startsWith('image/') ? 'image' : 'raw';
  }

  uploadBuffer(
    buffer: Buffer,
    options: { folder: string; resourceType: CloudinaryResourceType; filename: string },
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.resourceType,
          type: 'authenticated',
          use_filename: true,
          unique_filename: true,
          filename_override: options.filename,
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
          else resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(publicId: string, resourceType: CloudinaryResourceType): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated' });
  }

  getSignedUrl(publicId: string, resourceType: CloudinaryResourceType): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
  }
}
