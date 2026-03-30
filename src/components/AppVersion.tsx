const APP_VERSION = 'v0102';
const BUILD_DATE = '2703'; // DDMM
const GIT_SHA = import.meta.env.VITE_GIT_SHA || 'dev';

export function AppVersion() {
  return (
    <div className="text-[10.5px] text-light-t3 dark:text-dark-t3 font-mono tracking-wide">
      CRMappy {APP_VERSION}m{BUILD_DATE} · {GIT_SHA}
    </div>
  );
}
