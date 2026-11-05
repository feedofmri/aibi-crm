import type { Channel, Sample } from "../lib/api";
import { CHANNEL_META, firstName } from "../lib/channels";
import panel from "./Panel.module.css";
import styles from "./SenderPanel.module.css";

interface SenderPanelProps {
  channels: Channel[];
  samples: Sample[];
  channel: Channel;
  name: string;
  phone: string;
  showReply: boolean;
  onChannel: (channel: Channel) => void;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onShowReply: (value: boolean) => void;
  onSample: (id: string) => void;
}

export function SenderPanel(props: SenderPanelProps) {
  const { channels, samples, channel, name, phone, showReply } = props;

  return (
    <div className={panel.column}>
      <section className={panel.card} aria-labelledby="sender-title">
        <div className={panel.head}>
          <span className="eyebrow">Sender</span>
          <h2 id="sender-title" className={panel.title}>
            Who's writing in
          </h2>
        </div>

        <div className={styles.channels} role="radiogroup" aria-label="Channel">
          {channels.map((c) => {
            const meta = CHANNEL_META[c];
            const Icon = meta.icon;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={channel === c}
                className={styles.channel}
                data-selected={channel === c || undefined}
                onClick={() => props.onChannel(c)}
              >
                <Icon />
                <span>{meta.short}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.fields}>
          <label className={panel.label}>
            Name
            <input className={panel.input} value={name} placeholder="e.g. Nadia Islam" maxLength={200} onChange={(e) => props.onName(e.target.value)} />
          </label>
          <label className={panel.label}>
            Phone
            <input
              className={panel.input}
              value={phone}
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              onChange={(e) => props.onPhone(e.target.value)}
            />
          </label>
        </div>

        <label className={styles.toggle}>
          <input type="checkbox" checked={showReply} onChange={(e) => props.onShowReply(e.target.checked)} />
          <span>Show the suggested reply</span>
        </label>
      </section>

      <section className={`${panel.card} ${panel.cardFlush}`} aria-labelledby="samples-title">
        <div className={styles.samplesHead}>
          <span className="eyebrow">Try one</span>
          <h2 id="samples-title" className={panel.title}>
            Sample enquiries
          </h2>
        </div>
        <ul className={styles.samples}>
          {samples.map((sample) => {
            const Icon = CHANNEL_META[sample.channel].icon;
            return (
              <li key={sample.id}>
                <button type="button" className={styles.sample} onClick={() => props.onSample(sample.id)}>
                  <Icon />
                  <span className={styles.sampleText}>
                    <strong>{firstName(sample.name)}</strong>
                    <span>{sample.message}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
