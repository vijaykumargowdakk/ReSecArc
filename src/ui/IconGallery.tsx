import { DEVICE_CATALOG } from '../model/catalog';
import type { DeviceType } from '../model/schema';
import { DeviceIcon, iconKey } from './icons';

/** Development aid: every device kind's icon at three sizes. Open the app with `?gallery`. */
export function IconGallery() {
  return (
    <main className="gallery">
      <h1>ReSecArc device icons</h1>
      {(Object.keys(DEVICE_CATALOG) as DeviceType[]).map((type) => (
        <section key={type}>
          <h2>{DEVICE_CATALOG[type].label}</h2>
          <div className="gallery__row">
            {DEVICE_CATALOG[type].variants.map((v) => (
              <figure key={v.id}>
                <div className="gallery__sizes">
                  {[16, 24, 34].map((size) => (
                    <DeviceIcon key={size} type={type} variant={v.id} size={size} />
                  ))}
                </div>
                <figcaption>
                  {v.label}
                  <code>{iconKey(type, v.id)}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
