import type { LibraryGame } from "@/lib/gate-shared";
import crossyRoad from "@/assets/games/roadcros.html.asset.json";
import subwaySurfers from "@/assets/games/clsubwaysurfersbarcelona.html.asset.json";
import dta6 from "@/assets/games/dta6.html.asset.json";
import sushiria from "@/assets/games/papassushiria_101.zip.asset.json";
import bakeria from "@/assets/games/papasbakeria_101.zip.asset.json";
import cheeseria from "@/assets/games/papascheeseria_102_1.zip.asset.json";
import donuteria from "@/assets/games/papasdonuteria_102.zip.asset.json";
import pastaria from "@/assets/games/papaspastaria.zip.asset.json";
import cupcakeria from "@/assets/games/papascupcakeria.zip.asset.json";
import hotdoggeria from "@/assets/games/papashotdoggeria.zip.asset.json";
import wingeria from "@/assets/games/papaswingeria.zip.asset.json";
import pancakeria from "@/assets/games/papaspancakeria.zip.asset.json";
import freezeria from "@/assets/games/papasfreezeria.zip.asset.json";
import tacomia from "@/assets/games/papastacomia.zip.asset.json";
import burgeria from "@/assets/games/papasburgeria.zip.asset.json";
import pizzeria from "@/assets/games/papaspizzeria.zip.asset.json";
import happyWheels from "@/assets/games/HappyWheels_1.swf.asset.json";

export const gameLibrary: readonly LibraryGame[] = [
  { id: "crossy-road", title: "Crossy Road", fileName: "roadcros.html", url: crossyRoad.url, kind: "html" },
  { id: "subway-surfers", title: "Subway Surfers: Barcelona", fileName: "clsubwaysurfersbarcelona.html", url: subwaySurfers.url, kind: "html" },
  { id: "dta6", title: "DTA6", fileName: "dta6.html", url: dta6.url, kind: "html" },
  { id: "sushiria", title: "Papa's Sushiria", fileName: "papassushiria_101.zip", url: sushiria.url, kind: "flash" },
  { id: "bakeria", title: "Papa's Bakeria", fileName: "papasbakeria_101.zip", url: bakeria.url, kind: "flash" },
  { id: "cheeseria", title: "Papa's Cheeseria", fileName: "papascheeseria_102_1.zip", url: cheeseria.url, kind: "flash" },
  { id: "donuteria", title: "Papa's Donuteria", fileName: "papasdonuteria_102.zip", url: donuteria.url, kind: "flash" },
  { id: "pastaria", title: "Papa's Pastaria", fileName: "papaspastaria.zip", url: pastaria.url, kind: "flash" },
  { id: "cupcakeria", title: "Papa's Cupcakeria", fileName: "papascupcakeria.zip", url: cupcakeria.url, kind: "flash" },
  { id: "hotdoggeria", title: "Papa's Hot Doggeria", fileName: "papashotdoggeria.zip", url: hotdoggeria.url, kind: "flash" },
  { id: "wingeria", title: "Papa's Wingeria", fileName: "papaswingeria.zip", url: wingeria.url, kind: "flash" },
  { id: "pancakeria", title: "Papa's Pancakeria", fileName: "papaspancakeria.zip", url: pancakeria.url, kind: "flash" },
  { id: "freezeria", title: "Papa's Freezeria", fileName: "papasfreezeria.zip", url: freezeria.url, kind: "flash" },
  { id: "tacomia", title: "Papa's Taco Mia", fileName: "papastacomia.zip", url: tacomia.url, kind: "flash" },
  { id: "burgeria", title: "Papa's Burgeria", fileName: "papasburgeria.zip", url: burgeria.url, kind: "flash" },
  { id: "pizzeria", title: "Papa's Pizzeria", fileName: "papaspizzeria.zip", url: pizzeria.url, kind: "flash" },
  { id: "happy-wheels", title: "Happy Wheels", fileName: "HappyWheels_1.swf", url: happyWheels.url, kind: "flash" },
];
