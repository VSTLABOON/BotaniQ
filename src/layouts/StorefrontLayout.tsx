import { Outlet } from 'react-router-dom';
import CartDrawer from '../components/ui/CartDrawer';
import { useTenant } from '../context/TenantContext';
import { isPlatformDomain } from '../lib/domain';

export default function StorefrontLayout() {
  const { status } = useTenant();
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isPlatform = (!isLocal && isPlatformDomain(hostname)) || status === 'platform';

  return (
    <>
      <Outlet />
      {!isPlatform && <CartDrawer />}
    </>
  );
}
