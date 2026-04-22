import { Admin } from './admin';
import { Analytics } from './analytics';
import { Auth } from './auth';
import { Common } from './common';
import { Consent } from './consent';
import { Contact } from './contact';
import { Dashboard } from './dashboard';
import { Emails } from './emails';
import { Errors } from './errors';
import { Features } from './features';
import { Footer } from './footer';
import { Help } from './help';
import { Hero } from './hero';
import { LinkForm } from './link-form';
import { Navigation } from './navigation';
import { Preview } from './preview';
import { Privacy } from './privacy';
import { ProjectPage } from './project-page';
import { QRCode } from './qrcode';
import { Settings } from './settings';
import { Terms } from './terms';
import { TwoFactor } from './two-factor';
import { Unlock } from './unlock';

export const enMessages = {
  Common,
  Consent,
  Navigation,
  Hero,
  Features,
  LinkForm,
  Dashboard,
  Analytics,
  Settings,
  Admin,
  Contact,
  Help,
  Terms,
  Privacy,
  Preview,
  QRCode,
  TwoFactor,
  Unlock,
  Errors,
  Footer,
  Auth,
  ProjectPage,
  Emails
} as const;
