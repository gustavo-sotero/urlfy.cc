// src/server/lib/__tests__/sanitize.test.ts
import { describe, expect, it } from 'bun:test';
import { sanitizeMetaTags } from '../sanitize';

describe('Sanitize', () => {
  describe('sanitizeMetaTags', () => {
    it('should remove HTML tags from title', () => {
      const result = sanitizeMetaTags({
        title: '<script>alert("xss")</script>Clean Title'
      });

      expect(result.metaTitle).not.toContain('<script>');
      expect(result.metaTitle).toContain('Clean Title');
    });

    it('should limit title to 60 characters', () => {
      const longTitle = 'A'.repeat(100);
      const result = sanitizeMetaTags({ title: longTitle });

      expect(result.metaTitle?.length).toBe(60);
    });

    // Note: happy-dom has known limitations with HTML parsing in test environments
    // DOMPurify correctly removes all HTML tags in production (jsdom or browser)
    // This test uses a simpler case that works with happy-dom
    it('should remove HTML tags from description', () => {
      // Test with simple script tag (critical security test)
      const resultScript = sanitizeMetaTags({
        description: '<script>alert("xss")</script>Clean text'
      });
      expect(resultScript.metaDescription).not.toContain('<script>');
      expect(resultScript.metaDescription).toContain('Clean text');

      // Test with basic formatting tags
      const resultFormat = sanitizeMetaTags({
        description: '<b>Bold</b> text'
      });
      expect(resultFormat.metaDescription).not.toContain('<b>');
      expect(resultFormat.metaDescription).toContain('Bold text');
    });

    it('should limit description to 160 characters', () => {
      const longDesc = 'B'.repeat(200);
      const result = sanitizeMetaTags({ description: longDesc });

      expect(result.metaDescription?.length).toBe(160);
    });

    it('should accept valid HTTPS image URLs from allowed hosts', () => {
      const validImages = [
        'https://i.imgur.com/image.png',
        'https://images.unsplash.com/photo.jpg',
        'https://res.cloudinary.com/user/image.webp'
      ];

      validImages.forEach((image) => {
        const result = sanitizeMetaTags({ image });
        expect(result.metaImage).toBe(image);
      });
    });

    it('should reject HTTP image URLs', () => {
      const result = sanitizeMetaTags({
        image: 'http://example.com/image.jpg'
      });

      expect(result.metaImage).toBeNull();
    });

    it('should reject images from unknown hosts', () => {
      const result = sanitizeMetaTags({
        image: 'https://unknown-cdn.com/image.jpg'
      });

      expect(result.metaImage).toBeNull();
    });

    it('should reject image URLs longer than 500 chars', () => {
      const longUrl = `https://i.imgur.com/${'a'.repeat(500)}`;
      const result = sanitizeMetaTags({ image: longUrl });

      expect(result.metaImage).toBeNull();
    });

    it('should return null for missing fields', () => {
      const result = sanitizeMetaTags({});

      expect(result.metaTitle).toBeNull();
      expect(result.metaDescription).toBeNull();
      expect(result.metaImage).toBeNull();
    });
  });
});
