"use client";

import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/langs";
import type { ShowerCluster } from "@/lib/shower";
import { rainKey } from "@/lib/shower-core";
import { tryAfterRain, tryAfterWord } from "../actions";
import app from "../app.module.css";
import { Material } from "./Material";
import { TryForm } from "./TryForm";

const REF_ID = "try-ref";

/**
 * これで言ってみる, a page of its own after the rain: the rain's sentences on one side (lit once the learner has asked),
 * the field on the other, so they can borrow from the sentences while writing. On a phone the sentences come first,
 * right above the field. The page of what they said keeps the same sentences beside the correction.
 */
export function TryPage({
  cluster,
  source,
  revealed,
  onReveal,
  onBack,
  native,
  target,
  rate,
}: {
  cluster: ShowerCluster;
  source: "library" | "minna";
  revealed: boolean;
  onReveal: () => void;
  onBack: () => void;
  native: Lang;
  target: Lang;
  rate: number;
}) {
  const t = getDict(native);
  const action = useMemo(() => {
    const material = { source, ids: cluster.sentences.map((s) => s.id) };
    return cluster.word ? tryAfterWord.bind(null, cluster.word, material) : tryAfterRain.bind(null, cluster.patternId, material);
  }, [cluster, source]);
  return (
    <>
      <header className={app.subbar}>
        <button type="button" className={app.iconLink} onClick={onBack} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </button>
        <h1 className={app.subtitleStrong}>{cluster.word ? t.shower.wordTryTitle : t.shower.tryTitle}</h1>
      </header>
      <div className={`${app.bodyTight} ${app.split}`}>
        <div className={`${app.col} ${app.stick}`}>
          <Material
            id={REF_ID}
            label={t.shower.tryRef}
            sentences={cluster.sentences}
            lit={revealed}
            way={cluster.label}
            onReveal={onReveal}
            native={native}
            target={target}
            rate={rate}
            compact
          />
        </div>
        <div className={app.col}>
          <TryForm action={action} patternId={rainKey(cluster)} refId={REF_ID} native={native} target={target} focus />
        </div>
      </div>
    </>
  );
}
