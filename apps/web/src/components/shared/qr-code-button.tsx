// src/components/shared/qr-code-button.tsx
'use client';

import { QrCode } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface Props {
  shortCode?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function QRCodeButton({
  shortCode,
  variant = 'ghost',
  size = 'sm'
}: Props) {
  const t = useTranslations('QRCode');
  const [qrSize, setQrSize] = useState('300');
  const [qrFormat, setQrFormat] = useState<'png' | 'svg'>('png');
  const [isOpen, setIsOpen] = useState(false);

  if (!shortCode) {
    return null;
  }

  const qrUrl = `/api/links/by-code/${shortCode}/qr?size=${qrSize}&format=${qrFormat}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-${shortCode}.${qrFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} aria-label={t('ariaLabel')}>
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* QR Code Preview */}
          <div className="flex justify-center rounded-lg border bg-muted p-6">
            <Image
              src={qrUrl}
              alt={t('altText', { code: shortCode })}
              width={Number.parseInt(qrSize, 10)}
              height={Number.parseInt(qrSize, 10)}
              className="max-w-full"
              unoptimized
            />
          </div>

          {/* Controls */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <label htmlFor="qr-size" className="text-sm font-medium">
                {t('sizeLabel')}
              </label>
              <Select value={qrSize} onValueChange={setQrSize}>
                <SelectTrigger id="qr-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="200">200x200</SelectItem>
                  <SelectItem value="300">300x300</SelectItem>
                  <SelectItem value="500">500x500</SelectItem>
                  <SelectItem value="1000">1000x1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="qr-format" className="text-sm font-medium">
                {t('formatLabel')}
              </label>
              <Select
                value={qrFormat}
                onValueChange={(value) => setQrFormat(value as 'png' | 'svg')}
              >
                <SelectTrigger id="qr-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1">
              {t('download')}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
