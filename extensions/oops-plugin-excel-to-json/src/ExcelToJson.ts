import path from "path";
import { config } from "./main";

const fs = require("fs");
const excel = require("exceljs");

/** Return a cell value, including a formula's cached result. */
function getCellValue(cell: any) {
    const value = cell.value;
    if (value != null && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
        if (value.result == null) {
            console.warn(`Formula cell ${cell.address} has no cached result. Recalculate and save the Excel/WPS file.`);
        }
        return value.result;
    }
    return value;
}

function isEmptyValue(value: any) {
    return value == null || value === "";
}

/** Convert one Excel worksheet to an ordered JSON array. */
async function convert(src: string, dst: string) {
    const rows: any[] = [];
    const keys: any[] = [];
    const types: any[] = [];
    const workbook = new excel.Workbook();

    await workbook.xlsx.readFile(src);
    const worksheet = workbook.getWorksheet(1);
    worksheet.eachRow((row: any, rowNumber: number) => {
        const data: any = {};
        row.eachCell((cell: any, colNumber: number) => {
            const value = getCellValue(cell);
            if (rowNumber === 2) {
                keys.push(value);
            } else if (rowNumber === 3) {
                types.push(value);
            } else if (rowNumber > 3) {
                const index = colNumber - 1;
                const key = keys[index];
                switch (types[index]) {
                    case "int":
                    case "float":
                        data[key] = parseFloat(value);
                        break;
                    case "string":
                        data[key] = value;
                        break;
                    case "any":
                        data[key] = JSON.parse(value);
                        break;
                }
            }
        });

        // A blank data row is ignored. No id or KEY column is required.
        if (rowNumber > 3 && Object.values(data).some((value) => !isEmptyValue(value))) {
            rows.push(data);
        }
    });

    fs.writeFileSync(dst, JSON.stringify(rows), "utf8");
    console.log("Excel data generated successfully", dst);
}

export async function run() {
    const inputExcelPath = path.join(__dirname, config.PathExcel);
    const outJsonPath = path.join(__dirname, config.PathJson);
    const files = fs.readdirSync(inputExcelPath);
    for (const f of files) {
        const name = f.substring(0, f.indexOf("."));
        const ext = f.toString().substring(f.lastIndexOf(".") + 1);
        if (ext === "xlsx") {
            await convert(inputExcelPath + f, outJsonPath + name + ".json");
        }
    }
}
