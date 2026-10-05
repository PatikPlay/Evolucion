#!/usr/bin/env bash
# Usage: packages/sim/scripts/tune.sh <years> '<config json>' [seeds...]
years=${1:-10}; cfg=${2:-'{}'}; shift 2
seeds=${@:-a b c d e f g s1}
dir=$(dirname "$0")
printf '%s\n' $seeds | xargs -P 4 -I@@ npx tsx "$dir/tune.ts" @@ "$years" "$cfg" > /tmp/tune.$$.out
node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").map(JSON.parse);
const D = ["starv","thirst","pred","cold","heat","dis","old","combat","drown","tox","cull"];
const A = ["rest","explore","graze","drink","flee","hunt","forage","scav","court","group","defend","care","hide","dig","store","migrate","sleep","hib","fight"];
let finals = [];
for (const l of lines.sort((a,b)=>a.seed.localeCompare(b.seed))) { finals.push(l.pops[l.pops.length-1]); console.log(l.seed.padEnd(4), l.pops.join(" ").padEnd(60), "massT", l.massT0, "->", l.massT, "gen", l.gen); }
const sum = (k) => lines.reduce((a, l) => a.map((v, i) => v + l[k][i]), new Array(lines[0][k].length).fill(0));
const d = sum("deaths"); const tot = d.reduce((a,b)=>a+b,0)||1;
console.log("deaths:", d.map((v,i)=>v?D[i]+":"+Math.round(100*v/tot)+"%":"").filter(Boolean).join(" "));
const a = sum("acts").map(v=>v/lines.length);
console.log("acts:", a.map((v,i)=>v>=1?A[i]+":"+v.toFixed(0)+"%":"").filter(Boolean).join(" "));
finals.sort((a,b)=>a-b); console.log("final pop median", finals[Math.floor(finals.length/2)], "min", finals[0], "max", finals[finals.length-1]);
' /tmp/tune.$$.out
rm -f /tmp/tune.$$.out
