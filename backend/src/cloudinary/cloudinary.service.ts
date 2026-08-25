import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'raw';
/// 'authenticated' (default): no public URL, only resolves via a signed link
/// this service generates — used for anything gated behind an app-level
/// permission check (assignment/leave attachments). 'upload': Cloudinary's
/// normal public delivery type, for content meant to render directly for
/// anyone in its audience with no per-request auth check (announcement
/// images) — the upload response's plain `secure_url` is the whole story,
/// no signing needed.
export type CloudinaryDeliveryType = 'authenticated' | 'upload';

/** Defaults every call to `type: 'authenticated'` so existing callers
 * (assignments, leave attachments) are unaffected — only a caller that
 * explicitly passes `deliveryType: 'upload'` gets a publicly-resolvable
 * asset. Downloads of authenticated assets still go entirely through the
 * owning controller's own permission check; Cloudinary is just where the
 * bytes live either way. */
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
    options: {
      folder: string;
      resourceType: CloudinaryResourceType;
      filename: string;
      deliveryType?: CloudinaryDeliveryType;
    },
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.resourceType,
          type: options.deliveryType ?? 'authenticated',
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

  async destroy(
    publicId: string,
    resourceType: CloudinaryResourceType,
    deliveryType: CloudinaryDeliveryType = 'authenticated',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: deliveryType });
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
