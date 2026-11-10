// /admin - US-22 add a validated challenge, US-23 withdraw / re-publish one
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { getCurrentUser } from "~/api/auth";
import { ApiError } from "~/api/http";
import {
  createChallenge,
  listChallenges,
  publishChallenge,
  withdrawChallenge,
  type AdminChallenge,
  type ChallengeForm,
  createCosmetic,
  listCosmetics,
  toggleCosmetic,
  type AdminCosmetic,
  searchUsers,
  changeBalance,
  type AdminUser,
} from "~/api/admin";
import { SkinArt } from "~/components/skins";

/** Shrinks the picked picture to at most 320px and returns a PNG data URL. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * k));
      canvas.height = Math.max(1, Math.round(img.height * k));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("This file is not a readable image"));
    img.src = url;
  });
}

const empty: ChallengeForm = {
  title: "GATE // ",
  description: "Write a function `solve(a, b)` that ...",
  inputDescription: "",
  outputDescription: "",
  functionName: "solve",
  starterCode: "function solve(a, b) {\n  // TODO\n\n}\n",
  examples: "solve(1, 2) -> 3",
  testsJson: '[{"input":[1,2],"expected":3},{"input":[0,0],"expected":0}]',
  referenceSolution: "function solve(a, b) {\n  return a + b;\n}\n",
};

const field = "w-full bg-[#02050f] border border-neon text-white px-3 py-2 font-sans text-lg outline-none focus:border-glow-neon-sm";
const label = "block font-pixel text-yellow text-xl mt-4 mb-1";

export default function Admin() {
  const user = getCurrentUser();
  const [items, setItems] = useState<AdminChallenge[]>([]);
  const [form, setForm] = useState<ChallengeForm>(empty);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skins, setSkins] = useState<AdminCosmetic[]>([]);
  const [players, setPlayers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [balMsg, setBalMsg] = useState<string | null>(null);
  const findPlayers = () => searchUsers(query).then(setPlayers).catch(() => setBalMsg("Could not load players"));
  const applyBalance = async (id: number, mode: "set" | "add", sign = 1) => {
    const n = Number(amounts[id]);
    if (!Number.isInteger(n)) return setBalMsg("Enter a whole number");
    try {
      const u = await changeBalance(id, mode, n * sign);
      setPlayers((ps) => ps.map((p) => (p.id === u.id ? u : p)));
      setBalMsg(`${u.username}: ${u.pixels} PIXELS`);
    } catch (e) {
      setBalMsg(e instanceof Error ? e.message : "Failed");
    }
  };
  const [skinName, setSkinName] = useState("");
  const [skinPrice, setSkinPrice] = useState("500");
  const [skinImage, setSkinImage] = useState<string | null>(null);
  const [skinMsg, setSkinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reloadSkins = () => listCosmetics().then(setSkins).catch(() => {});

  const publishSkin = async (e: FormEvent) => {
    e.preventDefault();
    setSkinMsg(null);
    if (!skinImage) return setSkinMsg({ ok: false, text: "Choose a picture for the item" });
    try {
      const c = await createCosmetic(skinName, Number(skinPrice), skinImage);
      setSkinMsg({ ok: true, text: `Published "${c.name}" in the store` });
      setSkinName("");
      setSkinImage(null);
      void reloadSkins();
    } catch (err) {
      setSkinMsg({ ok: false, text: err instanceof Error ? err.message : "Could not publish" });
    }
  };

  const reload = () =>
    listChallenges()
      .then(setItems)
      .catch((e) => setError({ text: e instanceof Error ? e.message : "Could not load challenges" }));

  useEffect(() => {
    if (user?.admin) {
      void reload();
      void reloadSkins();
    }
  }, []);

  if (!user?.admin) {
    return (
      <div className="flex flex-col items-center gap-6 font-pixel mt-24">
        <h2 className="text-pink text-5xl">ADMINISTRATOR ACCESS REQUIRED</h2>
        <Link to="/" className="border-2 border-neon px-8 py-2 text-yellow text-3xl">
          Back to Menu
        </Link>
      </div>
    );
  }

  const set = (k: keyof ChallengeForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const c = await createChallenge(form);
      setOk(`Published "${c.title}"`);
      void reload();
    } catch (err) {
      setError({
        field: err instanceof ApiError ? err.data?.field : undefined,
        text: err instanceof Error ? err.message : "Could not publish",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: AdminChallenge) => {
    try {
      if (c.published) await withdrawChallenge(c.id);
      else await publishChallenge(c.id);
      void reload();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : "Action failed" });
    }
  };

  const bad = (k: string) => (error?.field === k ? "border-pink" : "");

  return (
    <>
      <div className="star-background" />
      <div className="mx-auto max-w-250 font-pixel pb-16">
        <h1 className="text-yellow text-[72px]/none text-glow-sm text-center my-6">ADMIN / CHALLENGES</h1>

        <form onSubmit={submit} className="border-2 border-neon bg-[#070c1e]/90 p-6">
          <h2 className="text-neon text-3xl border-b border-neon/40 pb-2">&gt; NEW CHALLENGE (EASY)</h2>
          <label className={label}>TITLE</label>
          <input className={`${field} ${bad("title")}`} value={form.title} onChange={set("title")} />
          <label className={label}>STATEMENT</label>
          <textarea className={`${field} ${bad("description")}`} rows={3} value={form.description} onChange={set("description")} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>INPUT FORMAT</label>
              <input className={field} value={form.inputDescription} onChange={set("inputDescription")} />
            </div>
            <div>
              <label className={label}>OUTPUT FORMAT</label>
              <input className={field} value={form.outputDescription} onChange={set("outputDescription")} />
            </div>
          </div>
          <label className={label}>FUNCTION NAME</label>
          <input className={`${field} ${bad("functionName")}`} value={form.functionName} onChange={set("functionName")} />
          <label className={label}>STARTER CODE</label>
          <textarea className={`${field} font-mono`} rows={4} value={form.starterCode} onChange={set("starterCode")} />
          <label className={label}>EXAMPLES (shown to players)</label>
          <textarea className={field} rows={2} value={form.examples} onChange={set("examples")} />
          <label className={label}>TESTS (JSON: input array + expected)</label>
          <textarea className={`${field} font-mono ${bad("testsJson")}`} rows={4} value={form.testsJson} onChange={set("testsJson")} />
          <label className={label}>REFERENCE SOLUTION (must pass all tests)</label>
          <textarea className={`${field} font-mono ${bad("referenceSolution")}`} rows={5} value={form.referenceSolution} onChange={set("referenceSolution")} />

          {error && <p className="text-pink text-xl mt-4 border border-pink/40 bg-pink/10 px-3 py-2 font-sans">[!] {error.text}</p>}
          {ok && <p className="text-neon text-xl mt-4 border border-neon/40 bg-neon/10 px-3 py-2 font-sans">[OK] {ok}</p>}
          <button disabled={busy} className="w-full mt-6 py-3 bg-pink border-2 border-yellow text-black text-3xl disabled:opacity-50">
            {busy ? "CHECKING..." : "PUBLISH CHALLENGE"}
          </button>
        </form>

        <h2 className="text-neon text-3xl mt-10 mb-3">&gt; CATALOG ({items.length})</h2>
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between border border-neon/50 bg-[#070c1e]/90 px-4 py-3">
              <span className="text-yellow text-2xl">
                {c.title} <span className="text-neon text-lg">[{c.difficulty}]</span>
              </span>
              <span className="flex items-center gap-4">
                <span className={c.published ? "text-neon text-xl" : "text-pink text-xl"}>{c.published ? "PUBLISHED" : "WITHDRAWN"}</span>
                <button onClick={() => toggle(c)} className="border border-neon px-3 py-1 text-yellow text-xl hover:text-glow-sm">
                  {c.published ? "Withdraw" : "Publish"}
                </button>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="text-neon text-3xl mt-12 mb-3">&gt; NEW COSMETIC (STORE SKIN)</h2>
        <form onSubmit={publishSkin} className="border-2 border-neon bg-[#070c1e]/90 p-6">
          <label className={label}>ITEM NAME</label>
          <input className={field} value={skinName} onChange={(e) => setSkinName(e.target.value)} maxLength={40} />
          <label className={label}>PRICE (PIXELS)</label>
          <input className={field} type="number" min={0} value={skinPrice} onChange={(e) => setSkinPrice(e.target.value)} />
          <label className={label}>PICTURE (PNG / JPEG / WebP / GIF)</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="font-sans text-white"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setSkinImage(await readImage(f));
              } catch (err) {
                setSkinMsg({ ok: false, text: err instanceof Error ? err.message : "Bad image" });
              }
            }}
          />
          {skinImage && <img src={skinImage} alt="" className="h-32 mt-3 border border-neon/50" style={{ imageRendering: "pixelated" }} />}
          {skinMsg && (
            <p className={`${skinMsg.ok ? "text-neon border-neon/40 bg-neon/10" : "text-pink border-pink/40 bg-pink/10"} text-xl mt-4 border px-3 py-2 font-sans`}>
              {skinMsg.text}
            </p>
          )}
          <button className="w-full mt-6 py-3 bg-pink border-2 border-yellow text-black text-3xl">PUBLISH SKIN</button>
        </form>

        <ul className="flex flex-col gap-2 mt-4">
          {skins.map((c) => (
            <li key={c.id} className="flex items-center justify-between border border-neon/50 bg-[#070c1e]/90 px-4 py-3">
              <span className="flex items-center gap-3 text-yellow text-2xl">
                <SkinArt id={c.id} size="small" className="h-10 w-auto" />
                {c.name} <span className="text-neon text-lg">{c.price} PIXELS</span>
              </span>
              <span className="flex items-center gap-4">
                <span className={c.published ? "text-neon text-xl" : "text-pink text-xl"}>{c.published ? "PUBLISHED" : "WITHDRAWN"}</span>
                <button
                  onClick={() => toggleCosmetic(c.id, !c.published).then(reloadSkins)}
                  className="border border-neon px-3 py-1 text-yellow text-xl hover:text-glow-sm"
                >
                  {c.published ? "Withdraw" : "Publish"}
                </button>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="text-neon text-3xl mt-12 mb-3">&gt; PLAYER BALANCE</h2>
        <div className="border-2 border-neon bg-[#070c1e]/90 p-6">
          <div className="flex gap-3">
            <input
              className={field}
              placeholder="username (empty = top 50)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findPlayers()}
            />
            <button onClick={findPlayers} className="px-6 bg-pink border-2 border-yellow text-black text-2xl">FIND</button>
          </div>
          {balMsg && <p className="text-neon text-xl mt-3 font-sans">{balMsg}</p>}
          <ul className="flex flex-col gap-2 mt-4">
            {players.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border border-neon/50 px-4 py-3">
                <span className="text-yellow text-2xl">
                  {p.username} <span className="text-neon text-lg">{p.pixels} PIXELS</span>
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-32 bg-[#0a0f25] border border-neon text-white px-2 py-1 font-sans"
                    value={amounts[p.id] ?? ""}
                    onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value })}
                  />
                  <button onClick={() => applyBalance(p.id, "add")} className="border border-neon px-3 py-1 text-yellow text-xl">+ Add</button>
                  <button onClick={() => applyBalance(p.id, "add", -1)} className="border border-neon px-3 py-1 text-pink text-xl">- Take</button>
                  <button onClick={() => applyBalance(p.id, "set")} className="border border-neon px-3 py-1 text-yellow text-xl">Set</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
