import { exec } from "@actions/exec";
import hasYarn from "has-yarn";
import hasPNPM from "has-pnpm";
import fs from "fs";
import path from "path";

let definedSizeLimit = "";
try {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "./package.json"), "utf8")
  );
  definedSizeLimit = pkg["size-limit"];
} catch (error) {
  console.log(`error getting definedSizes: ${error}`);
}

const INSTALL_STEP = "install";
const BUILD_STEP = "build";

class Term {
  async execSizeLimit(
    branch?: string,
    skipStep?: string,
    buildScript?: string,
    cleanScript?: string,
    windowsVerbatimArguments?: boolean,
    directory?: string
  ): Promise<{ status: number; output: string; definedSizeLimit?: string }> {
    const manager = hasYarn(directory)
      ? "yarn"
      : hasPNPM(directory)
      ? "pnpm"
      : "npm";
    let output = "";

    if (branch) {
      try {
        await exec(`git fetch origin ${branch} --depth=1`);
      } catch (error) {
        console.log("Fetch failed", error.message);
      }

      await exec(`git checkout -f ${branch}`);
    }

    if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
      await exec(`${manager} install`, [], {
        cwd: directory
      });
    }

    if (skipStep !== BUILD_STEP) {
      const script = buildScript || "build";
      await exec(`${manager} run ${script}`, [], {
        cwd: directory
      });
    }

    const status = await exec("pnpx size-limit --json", [], {
      windowsVerbatimArguments,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        }
      },
      cwd: directory
    });

    if (cleanScript) {
      await exec(`${manager} run ${cleanScript}`, [], {
        cwd: directory
      });
    }

    return {
      status,
      output,
      definedSizeLimit
    };
  }
}

export default Term;
