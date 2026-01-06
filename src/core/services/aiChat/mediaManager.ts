/**
 * Media Manager
 * Quản lý media (images, videos) với metadata để AI tìm kiếm
 */

import { MediaItem, MediaMetadata, Product } from '../../../shared/types/aiChat';
import { logger } from '../../../shared/utils/logger';

class MediaManager {
  /**
   * Tìm media theo query (màu sắc, sản phẩm, features)
   */
  findMediaByQuery(
    mediaItems: MediaItem[],
    query: string
  ): MediaItem[] {
    const queryLower = query.toLowerCase();

    // Tìm theo color mapping
    const colorMatches = mediaItems.filter(media => {
      if (!media.metadata.colors) return false;
      return media.metadata.colors.some(color => 
        color.toLowerCase().includes(queryLower) || 
        queryLower.includes(color.toLowerCase())
      );
    });

    // Tìm theo product name
    const productMatches = mediaItems.filter(media => {
      if (!media.metadata.productIds || media.metadata.productIds.length === 0) return false;
      // Có thể check product name nếu có product data
      return false; // TODO: implement khi có product data
    });

    // Tìm theo features/tags
    const featureMatches = mediaItems.filter(media => {
      const features = [
        ...(media.metadata.features || []),
        ...(media.metadata.tags || []),
        ...(media.metadata.aiTags || []),
      ];
      return features.some(feature => 
        feature.toLowerCase().includes(queryLower) ||
        queryLower.includes(feature.toLowerCase())
      );
    });

    // Tìm theo description
    const descriptionMatches = mediaItems.filter(media => {
      if (!media.metadata.description) return false;
      return media.metadata.description.toLowerCase().includes(queryLower);
    });

    // Combine và deduplicate
    const allMatches = [
      ...colorMatches,
      ...productMatches,
      ...featureMatches,
      ...descriptionMatches,
    ];

    const uniqueMatches = Array.from(
      new Map(allMatches.map(item => [item.id, item])).values()
    );

    return uniqueMatches;
  }

  /**
   * Tìm media cho product
   */
  findMediaForProduct(
    mediaItems: MediaItem[],
    product: Product
  ): MediaItem[] {
    return mediaItems.filter(media => {
      // Check productIds
      if (media.metadata.productIds?.includes(product.id)) {
        return true;
      }

      // Check product name in description
      if (media.metadata.description?.toLowerCase().includes(product.name.toLowerCase())) {
        return true;
      }

      // Check product name in tags
      const tags = [
        ...(media.metadata.tags || []),
        ...(media.metadata.aiTags || []),
      ];
      if (tags.some(tag => tag.toLowerCase().includes(product.name.toLowerCase()))) {
        return true;
      }

      return false;
    });
  }

  /**
   * Tìm media theo color
   */
  findMediaByColor(
    mediaItems: MediaItem[],
    colorQuery: string
  ): MediaItem[] {
    const colorLower = colorQuery.toLowerCase();

    // Color mapping (Vietnamese -> English)
    const colorMap: Record<string, string[]> = {
      'xanh': ['blue', 'green', 'xanh', 'navy', 'cyan'],
      'đỏ': ['red', 'đỏ', 'crimson', 'scarlet'],
      'vàng': ['yellow', 'vàng', 'gold', 'amber'],
      'trắng': ['white', 'trắng'],
      'đen': ['black', 'đen'],
      'hồng': ['pink', 'hồng', 'rose'],
      'tím': ['purple', 'tím', 'violet'],
      'cam': ['orange', 'cam'],
      'nâu': ['brown', 'nâu'],
      'xám': ['gray', 'grey', 'xám'],
    };

    // Find matching colors
    const matchingColors: string[] = [];
    for (const [vnColor, enColors] of Object.entries(colorMap)) {
      if (colorLower.includes(vnColor) || enColors.some(c => colorLower.includes(c))) {
        matchingColors.push(...enColors);
      }
    }

    return mediaItems.filter(media => {
      if (!media.metadata.colors) return false;
      return media.metadata.colors.some(color => {
        const colorLowerMedia = color.toLowerCase();
        return matchingColors.some(mc => colorLowerMedia.includes(mc)) ||
               matchingColors.some(mc => colorLowerMedia === mc);
      });
    });
  }

  /**
   * Update media metadata
   */
  updateMediaMetadata(
    media: MediaItem,
    metadata: Partial<MediaMetadata>
  ): MediaItem {
    return {
      ...media,
      metadata: {
        ...media.metadata,
        ...metadata,
        // Merge arrays
        colors: metadata.colors || media.metadata.colors,
        productIds: metadata.productIds || media.metadata.productIds,
        variants: metadata.variants || media.metadata.variants,
        features: metadata.features || media.metadata.features,
        tags: metadata.tags || media.metadata.tags,
        aiTags: metadata.aiTags || media.metadata.aiTags,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Parse color từ text (VD: "áo xanh" -> ["blue", "xanh"])
   */
  parseColorsFromText(text: string): string[] {
    const colorMap: Record<string, string[]> = {
      'xanh': ['blue', 'green', 'xanh', 'navy'],
      'đỏ': ['red', 'đỏ'],
      'vàng': ['yellow', 'vàng'],
      'trắng': ['white', 'trắng'],
      'đen': ['black', 'đen'],
      'hồng': ['pink', 'hồng'],
      'tím': ['purple', 'tím'],
      'cam': ['orange', 'cam'],
      'nâu': ['brown', 'nâu'],
      'xám': ['gray', 'grey', 'xám'],
    };

    const textLower = text.toLowerCase();
    const foundColors: string[] = [];

    for (const [vnColor, enColors] of Object.entries(colorMap)) {
      if (textLower.includes(vnColor)) {
        foundColors.push(...enColors);
      }
    }

    return Array.from(new Set(foundColors)); // Deduplicate
  }

  /**
   * Tạo media item từ file upload
   */
  createMediaItemFromFile(
    file: File,
    type: 'image' | 'video',
    metadata?: Partial<MediaMetadata>
  ): MediaItem {
    const url = URL.createObjectURL(file);

    return {
      id: `media_${Date.now()}_${Math.random()}`,
      type,
      url,
      fileName: file.name,
      fileSize: file.size,
      metadata: {
        colors: metadata?.colors || [],
        productIds: metadata?.productIds || [],
        variants: metadata?.variants || [],
        features: metadata?.features || [],
        tags: metadata?.tags || [],
        description: metadata?.description,
        aiTags: metadata?.aiTags || [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const mediaManager = new MediaManager();

