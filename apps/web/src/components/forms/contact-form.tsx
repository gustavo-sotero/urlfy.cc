'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeErrorMessage } from '@/lib/utils/error';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function ContactForm() {
  const t = useTranslations('Contact');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const contactFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t('form.validation.nameMin')).max(255),
        email: z.string().email(t('form.validation.emailInvalid')).max(255),
        subject: z.string().min(3, t('form.validation.subjectMin')).max(255),
        message: z
          .string()
          .min(10, t('form.validation.messageMin'))
          .max(5000, t('form.validation.messageMax')),
        consent: z.boolean().refine((val) => val === true, {
          message: t('form.validation.consentRequired')
        })
      }),
    [t]
  );

  type ContactFormData = z.infer<typeof contactFormSchema>;

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
      consent: false
    }
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(t('form.toast.rateLimitTitle'), {
            description: sanitizeErrorMessage(
              result.error?.message,
              t('form.toast.rateLimitDescription')
            )
          });
          return;
        }

        toast.error(t('form.toast.failedTitle'), {
          description: sanitizeErrorMessage(
            result.error?.message,
            t('form.toast.failedDescription')
          )
        });
        return;
      }

      setIsSubmitted(true);
      toast.success(t('form.toast.successTitle'), {
        description: result.message || t('form.toast.successDescription')
      });
      form.reset();
    } catch (error) {
      console.error('Contact form error:', error);
      toast.error(t('form.toast.networkTitle'), {
        description: t('form.toast.networkDescription')
      });
    }
  };

  if (isSubmitted) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          {t('form.successState.title')}
        </h3>
        <p className="mb-6 text-muted-foreground">
          {t('form.successState.description')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setIsSubmitted(false);
            form.reset();
          }}
        >
          {t('form.successState.sendAnother')}
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name Field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.namePlaceholder')}
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email Field */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('form.emailPlaceholder')}
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Subject Field */}
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.subject')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.subjectPlaceholder')}
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Message Field */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('message')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('form.messagePlaceholder')}
                  className="min-h-37.5"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                {field.value.length}/5000 {t('form.characters')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Consent Checkbox */}
        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t('form.consentTitle')}</FormLabel>
                <FormDescription>
                  {t('form.consentDescription')}
                </FormDescription>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('form.sending')}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {t('form.sendMessage')}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
