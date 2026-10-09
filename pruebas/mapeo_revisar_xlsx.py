# Mira adentro de un .xlsx del Mapeo con las herramientas de Python de serie
# (zipfile, xml) —nada del código de la página— y cuenta lo que hay, en JSON:
# las partes del zip, si cada XML está bien formado, las celdas combinadas,
# las listas desplegables y el formato condicional (sus rangos), las fórmulas
# con su valor guardado, el valor de cada celda, los comentarios con su fila,
# las cadenas compartidas (y si todas las celdas que las usan apuntan a una
# que existe). mapeo_test.mjs lo corre sobre el archivo de prueba y sobre lo
# que exporta herramientas/mapeo.html, y compara.
#
#   python3 -I pruebas/mapeo_revisar_xlsx.py archivo.xlsx
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ruta = sys.argv[1]
z = zipfile.ZipFile(ruta)
partes = [i.filename for i in z.infolist()]
mal_formados = []
for n in partes:
    if n.endswith(".xml") or n.endswith(".rels") or n.endswith(".vml"):
        try: ET.fromstring(z.read(n))
        except ET.ParseError as e: mal_formados.append(f"{n}: {e}")

sst_xml = z.read("xl/sharedStrings.xml").decode("utf-8") if "xl/sharedStrings.xml" in partes else ""
cadenas = []
if sst_xml:
    raiz = ET.fromstring(sst_xml)
    for si in raiz.findall("m:si", NS):
        cadenas.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    sst_count = int(raiz.get("count") or -1); sst_unique = int(raiz.get("uniqueCount") or -1)
else:
    sst_count = sst_unique = -1

libro = ET.fromstring(z.read("xl/workbook.xml"))
calc = libro.find("m:calcPr", NS)
nombres = [(d.get("name"), d.text) for d in libro.iter("{%s}definedName" % NS["m"])]
hoja = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
celdas, formulas, refs_sst, indices_rotos = {}, {}, 0, []
filas = []
for fila in hoja.iter("{%s}row" % NS["m"]):
    filas.append(int(fila.get("r")))
    for c in fila.findall("m:c", NS):
        ref, t = c.get("r"), c.get("t")
        f = c.find("m:f", NS); v = c.find("m:v", NS)
        texto_v = v.text if v is not None else None
        if f is not None:
            formulas[ref] = {"f": f.text or "", "si": f.get("si"), "ref": f.get("ref"), "v": texto_v}
            continue
        if texto_v is None: continue
        if t == "s":
            refs_sst += 1; i = int(texto_v)
            if i >= len(cadenas): indices_rotos.append(ref); continue
            celdas[ref] = cadenas[i]
        elif t in ("str", "inlineStr", "e"):
            celdas[ref] = texto_v if t != "inlineStr" else "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
        else:
            n = float(texto_v); celdas[ref] = int(n) if n == int(n) else n

combinadas = sorted(m.get("ref") for m in hoja.iter("{%s}mergeCell" % NS["m"]))
listas = [{"sqref": d.get("sqref"), "formula": (d.find("m:formula1", NS).text or "")} for d in hoja.iter("{%s}dataValidation" % NS["m"])]
condicional = [cf.get("sqref") for cf in hoja.iter("{%s}conditionalFormatting" % NS["m"])]
filtro = hoja.find("m:autoFilter", NS)
pane = hoja.find(".//m:pane", NS)
comentarios = []
if "xl/comments1.xml" in partes:
    for c in ET.fromstring(z.read("xl/comments1.xml")).iter("{%s}comment" % NS["m"]):
        comentarios.append({"ref": c.get("ref"), "texto": "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))})
vml_filas = []
vml = [n for n in partes if n.endswith(".vml")]
if vml:
    texto = z.read(vml[0]).decode("utf-8")
    # El ancla viene antes de la fila en el XML, adentro de cada <v:shape>.
    vml_filas = [{"anchor": m.group(1).strip(), "row": int(m.group(2))} for m in re.finditer(r"<x:Anchor>([^<]*)</x:Anchor>(?:(?!</v:shape>)[\s\S])*?<x:Row>(\d+)</x:Row>", texto)]

print(json.dumps({
    "partes": partes, "mal_formados": mal_formados, "filas": filas,
    "cadenas": len(cadenas), "sst_count": sst_count, "sst_unique": sst_unique, "refs_sst": refs_sst, "indices_rotos": indices_rotos,
    "calcPr": dict(calc.attrib) if calc is not None else None, "nombres": nombres,
    "combinadas": combinadas, "listas": listas, "condicional": condicional,
    "autoFilter": filtro.get("ref") if filtro is not None else None, "pane": dict(pane.attrib) if pane is not None else None,
    "formulas": formulas, "celdas": celdas, "comentarios": comentarios, "vml": vml_filas,
}, ensure_ascii=False))
