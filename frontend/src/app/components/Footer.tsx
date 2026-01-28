import { useAuth } from '@/app/contexts/AuthContext';

export function Footer() {
  const { appConfig } = useAuth();
  const enabled = appConfig.APP_FOOTER_ENABLED !== false && appConfig.APP_FOOTER_ENABLED !== 'false';
  if (!enabled) return null;
  const footerText = appConfig.APP_FOOTER_TEXT || '';
  const copyright = appConfig.APP_COPYRIGHT || '';
  const email = appConfig.APP_SUPPORT_EMAIL || '';
  const phone = appConfig.APP_SUPPORT_PHONE || '';

  if (!footerText && !copyright && !email && !phone) {
    return null;
  }

  return (
    <footer className="mt-10 border-t bg-white/60">
      <div className="container mx-auto px-4 py-4 text-sm text-muted-foreground flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          {footerText && <span>{footerText}</span>}
          {copyright && <span>{copyright}</span>}
        </div>
        <div className="flex flex-col gap-1 md:text-right">
          {email && <span>支持邮箱：{email}</span>}
          {phone && <span>支持电话：{phone}</span>}
        </div>
      </div>
    </footer>
  );
}
