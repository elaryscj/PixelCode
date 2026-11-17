// /admin - US-22 add a validated challenge, US-23 withdraw / re-publish one
import { useEffect, useState, type FormEvent } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
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
  getCosmeticTexture,
  updateCosmetic,
  listCosmetics,
  toggleCosmetic,
  type AdminCosmetic,
  searchUsers,
  changeBalance,
  type AdminUser,
} from "~/api/admin";
import { SkinArt, forgetSkin } from "~/components/skins";
import SkinEditor, { builtinTexture, loadTextureFromUrl, textureToDataUrl } from "~/components/admin/SkinEditor";
import EnglishOnly from "~/components/EnglishOnly";

const empty: ChallengeForm = {
  title: "GATE // ",
  description: "Write a method `solve(a, b)` that ...",
  inputDescription: "",
  outputDescription: "",
  functionName: "solve",
  starterCode: "", // empty: the server builds a Java starter whose types match the tests
  examples: "solve(1, 2) -> 3",
  testsJson: '[{"input":[1,2],"expected":3},{"input":[0,0],"expected":0}]',
  difficulty: "EASY",
  referenceSolution: "class Solution {\n    public static int solve(int a, int b) {\n        return a + b;\n    }\n}\n",
};

const field = "w-full bg-[#02050f] border border-neon text-white px-3 py-2 font-sans text-lg outline-none focus:border-glow-neon-sm";
const label = "block font-pixel text-yellow text-xl mt-4 mb-1";

function AdminScreen() {
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
  const [skinPixels, setSkinPixels] = useState<Uint8ClampedArray>(() => builtinTexture("neon_ronin"));
  /** the store item being edited (null = a new one) */
  const [editingSkin, setEditingSkin] = useState<string | null>(null);
  const [skinPrize, setSkinPrize] = useState(false);
  const [skinMsg, setSkinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reloadSkins = () => listCosmetics().then(setSkins).catch(() => {});

  const publishSkin = async (e: FormEvent) => {
    e.preventDefault();
    setSkinMsg(null);
    try {
      const texture = textureToDataUrl(skinPixels);
      if (editingSkin) {
        const c = await updateCosmetic(editingSkin, skinName, Number(skinPrice), texture, skinPrize);
        forgetSkin(c.id);
        setSkinMsg({ ok: true, text: `Saved "${c.name}"` });
      } else {
        const c = await createCosmetic(skinName, Number(skinPrice), texture, skinPrize);
        setSkinMsg({
          ok: true,
          text: c.seasonReward ? `"${c.name}" will go to this season's top 3` : `Published "${c.name}" in the store`,
        });
        setSkinName("");
      }
      void reloadSkins();
    } catch (err) {
      setSkinMsg({ ok: false, text: err instanceof Error ? err.message : "Could not publish" });
    }
  };

  const editSkin = async (id: string) => {
    setSkinMsg(null);
    try {
      const c = await getCosmeticTexture(id);
      if (!c.texture) return setSkinMsg({ ok: false, text: "This older item is a single picture and cannot be edited" });
      setSkinPixels(await loadTextureFromUrl(c.texture));
      setSkinName(c.name);
      setSkinPrice(String(c.price));
      setSkinPrize(!!c.seasonReward);
      setEditingSkin(id);
      document.getElementById("skin-editor")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setSkinMsg({ ok: false, text: err instanceof Error ? err.message : "Could not load the skin" });
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
          <label className={label}>DIFFICULTY (players see EASY gates first, HARD ones at higher MMR)</label>
          <select
            className={`${field} ${bad("difficulty")}`}
            value={form.difficulty}
            onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as ChallengeForm["difficulty"] }))}
          >
            <option value="EASY">EASY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HARD">HARD</option>
          </select>
          <label className={label}>METHOD NAME</label>
          <input className={`${field} ${bad("functionName")}`} value={form.functionName} onChange={set("functionName")} />
          <label className={label}>STARTER CODE (Java, optional: leave empty to generate it from the tests)</label>
          <textarea dir="ltr" className={`${field} font-mono`} rows={4} value={form.starterCode} onChange={set("starterCode")} />
          <label className={label}>EXAMPLES (shown to players)</label>
          <textarea className={field} rows={2} value={form.examples} onChange={set("examples")} />
          <label className={label}>TESTS (JSON: input array + expected)</label>
          <textarea dir="ltr" className={`${field} font-mono ${bad("testsJson")}`} rows={4} value={form.testsJson} onChange={set("testsJson")} />
          <label className={label}>REFERENCE SOLUTION (Java: class Solution, must pass all tests)</label>
          <textarea dir="ltr" className={`${field} font-mono ${bad("referenceSolution")}`} rows={5} value={form.referenceSolution} onChange={set("referenceSolution")} />

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

        <h2 id="skin-editor" className="text-neon text-3xl mt-12 mb-3">
          &gt; {editingSkin ? `EDIT STORE SKIN ${editingSkin}` : "NEW STORE SKIN"}
        </h2>
        <form onSubmit={publishSkin} className="border-2 border-neon bg-[#070c1e]/90 p-6">
          <SkinEditor pixels={skinPixels} onChange={setSkinPixels} />
          <label className={label}>ITEM NAME</label>
          <input className={field} value={skinName} onChange={(e) => setSkinName(e.target.value)} maxLength={40} />
          <label className={label}>PRICE (PIXELS)</label>
          <input className={field} type="number" min={0} value={skinPrice} onChange={(e) => setSkinPrice(e.target.value)} />
          <label className="flex items-start gap-3 mt-4 font-sans text-white cursor-pointer">
            <input type="checkbox" checked={skinPrize} onChange={(e) => setSkinPrize(e.target.checked)} className="mt-1 w-5 h-5 accent-yellow" />
            <span>
              <span className="font-pixel text-yellow text-xl">SEASON PRIZE</span>
              <span className="block text-sm text-gray-400">
                Not sold in the store. When the running season ends, places 1-3 get it (with their PIXELS). The price is
                ignored. If several prizes are waiting, the newest one is used.
              </span>
            </span>
          </label>
          {skinMsg && (
            <p className={`${skinMsg.ok ? "text-neon border-neon/40 bg-neon/10" : "text-pink border-pink/40 bg-pink/10"} text-xl mt-4 border px-3 py-2 font-sans`}>
              {skinMsg.text}
            </p>
          )}
          <button className="w-full mt-6 py-3 bg-pink border-2 border-yellow text-black text-3xl">
            {editingSkin ? "SAVE CHANGES" : "PUBLISH SKIN"}
          </button>
          {editingSkin && (
            <button
              type="button"
              onClick={() => {
                setEditingSkin(null);
                setSkinPrize(false);
                setSkinName("");
                setSkinMsg(null);
              }}
              className="w-full mt-3 py-2 border-2 border-neon text-yellow text-xl"
            >
              CANCEL EDITING (MAKE A NEW SKIN)
            </button>
          )}
        </form>

        <ul className="flex flex-col gap-2 mt-4">
          {skins.map((c) => (
            <li key={c.id} className="flex items-center justify-between border border-neon/50 bg-[#070c1e]/90 px-4 py-3">
              <span className="flex items-center gap-3 text-yellow text-2xl">
                <SkinArt id={c.id} size="small" className="h-10 w-auto" />
                {c.name}{" "}
                {c.seasonReward ? (
                  <span className="text-pink text-lg">
                    {c.awardedSeason ? `SEASON ${c.awardedSeason} PRIZE (AWARDED)` : "SEASON PRIZE (WAITING)"}
                  </span>
                ) : (
                  <span className="text-neon text-lg">{c.price} PIXELS</span>
                )}
              </span>
              <span className="flex items-center gap-4">
                <span className={c.published ? "text-neon text-xl" : "text-pink text-xl"}>{c.published ? "PUBLISHED" : "WITHDRAWN"}</span>
                {c.animated && (
                  <button onClick={() => editSkin(c.id)} className="border border-neon px-3 py-1 text-yellow text-xl hover:text-glow-sm">
                    Edit
                  </button>
                )}
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

export default function Admin() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => (
        <EnglishOnly>
          <AdminScreen />
        </EnglishOnly>
      )}</ClientOnly>;
}
