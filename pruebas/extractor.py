# -*- coding: utf-8 -*-
"""Sacar una declaración entera de index.html, para probar el código de
verdad en vez de una copia a mano.

Recorre el código como el lenguaje: una pila de contextos (template
adentro de código adentro de template, las veces que haga falta), con
comillas, escapes, comentarios y expresiones regulares.

Las expresiones regulares fueron lo último que faltó, y apareció en la
función más usada del archivo: esc() tiene /[&<>"']/g, con una comilla
doble y una simple adentro. Sin reconocerla, el extractor tomaba esas
comillas como el principio de dos strings y se iba hasta el final del
archivo. Para saber si una / abre una expresión o es una división se mira
lo anterior: después de un valor (un nombre, un número, un paréntesis que
cierra) es división; después de un operador, de una coma o de palabras
como return o typeof, es una expresión regular. Es la misma regla que usan
los resaltadores de sintaxis, y alcanza para todo este archivo."""
import io, os, re, sys

# Se puede apuntar a otra copia con INDEX_HTML: es como se comprueba que una
# prueba nueva DE VERDAD falla contra el código viejo.
# La raíz del repo es la carpeta de arriba de esta. Se puede apuntar a otra
# copia con INDEX (el mismo nombre que usan las pruebas de JavaScript; antes
# esto leía INDEX_HTML y aquellas INDEX, así que comprobar una regresión
# obligaba a poner las dos). INDEX_HTML se sigue aceptando.
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.environ.get("INDEX") or os.environ.get("INDEX_HTML") or os.path.join(RAIZ, "index.html"),
              encoding="utf-8").read()

# Después de esto, una / abre una expresión regular; después de cualquier
# otra cosa —un nombre, un número, un ) o un ]— es una división.
REGEX_DESPUES = set("(,=:[!&|?{};+-*%<>~^")
REGEX_DESPUES_DE = {"return", "typeof", "case", "do", "else", "in", "of", "new",
                    "delete", "void", "throw", "instanceof", "yield", "await"}

def _fin_de_regex(txt, i):
    """Si en i empieza una expresión regular, devuelve dónde termina (con las
    banderas). Si no se puede cerrar en la misma línea, None: era una
    división, y se adivinó mal."""
    j, n, en_clase = i + 1, len(txt), False
    while j < n:
        c = txt[j]
        if c == "\\": j += 2; continue
        if c == "\n": return None
        if en_clase:
            if c == "]": en_clase = False
        elif c == "[": en_clase = True
        elif c == "/":
            j += 1
            while j < n and txt[j].isalpha(): j += 1
            return j
        j += 1
    return None

def recorrer(txt, desde=0):
    """Entrega (i, c, prof) de cada carácter que es CÓDIGO. prof es la
    profundidad de ( [ { en ese punto, contando antes de abrir."""
    pila, marcas, prof, i, n = [], [], 0, desde, len(txt)
    ultimo, palabra = None, ""      # lo último que no fue espacio, y la palabra que termina ahí
    while i < n:
        c = txt[i]
        if pila and pila[-1] == "tpl":              # adentro de `...`
            if c == "\\": i += 2; continue
            if c == "`": pila.pop(); i += 1; ultimo, palabra = "`", ""; continue
            if c == "$" and txt[i+1:i+2] == "{":    # ...y acá vuelve a ser código
                pila.append("sub"); marcas.append(prof); prof += 1; i += 2
                ultimo, palabra = "{", ""; continue
            i += 1; continue
        if c in "\"'":                              # string común
            q, i = c, i + 1
            while i < n:
                if txt[i] == "\\": i += 2; continue
                if txt[i] == q: i += 1; break
                i += 1
            ultimo, palabra = q, ""; continue
        if c == "`": pila.append("tpl"); i += 1; continue
        if c == "/" and txt[i+1:i+2] == "/":
            j = txt.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and txt[i+1:i+2] == "*":
            j = txt.find("*/", i); i = n if j < 0 else j + 2; continue
        if c == "/" and (ultimo is None or ultimo in REGEX_DESPUES or palabra in REGEX_DESPUES_DE):
            fin = _fin_de_regex(txt, i)
            if fin is not None:
                i, ultimo, palabra = fin, "/", ""; continue
        if c in "([{":
            yield (i, c, prof); prof += 1; i += 1; ultimo, palabra = c, ""; continue
        if c in ")]}":
            prof -= 1
            if marcas and pila and pila[-1] == "sub" and prof == marcas[-1]:
                marcas.pop(); pila.pop(); i += 1; continue   # este } cierra un ${
            yield (i, c, prof); i += 1; ultimo, palabra = c, ""; continue
        if not c.isspace():
            palabra = (palabra + c) if (c.isalnum() or c in "_$") else ""
            ultimo = c
        yield (i, c, prof); i += 1
    if pila or prof: raise SyntaxError("quedó abierto: pila=%r prof=%d" % (pila, prof))

def balanceada(txt):
    """Si el fragmento cierra todo lo que abre (una declaración de una línea)."""
    try:
        list(recorrer(txt))
        return True
    except SyntaxError:
        return False

def grab(name, fuente=None):
    txt = src if fuente is None else fuente
    m = re.search(r'\n(?:function|async function|const|let) %s\s*[=(]' % re.escape(name), txt)
    if not m: sys.exit("no se encontró " + name)
    desde = m.end() - 1
    fin_linea = txt.find("\n", desde)
    if balanceada(txt[desde:fin_linea+1]): return txt[m.start()+1:fin_linea+1]
    for j, c, prof in recorrer(txt, desde):
        if c not in ")]}" or prof != 0: continue
        resto = re.match(r'^\s*(..?)', txt[j+1:])
        prox = resto.group(1)[0] if resto else ""
        sig = (resto.group(1)[1:2] if resto else "") or ""
        # Con ; pegado, la declaración terminó.
        if prox == ";": return txt[m.start()+1:j+1+txt[j+1:].index(";")+1]
        # Un /* o // después del cierre NO es una división: es el comentario
        # de lo que viene DESPUÉS. Tomarlo como continuación hacía que se
        # trajera la declaración siguiente pegada, y el error salía como
        # "ya está declarado", en otro archivo y sin relación aparente.
        if prox == "/" and sig in ("/", "*"): return txt[m.start()+1:j+1]
        # Si lo que sigue puede continuar la expresión, todavía no terminó:
        # la lista de parámetros de una función (sigue el { del cuerpo), o
        # un .join/.map pegado a un array o a un paréntesis.
        if prox in ".([{+-*/?:|&,": continue
        return txt[m.start()+1:j+1]
    sys.exit("no cerró " + name)

estilo = re.search(r'<style>(.*?)</style>', src, re.S).group(1)

def cuerpo_click(nombre, fuente=None):
    """El cuerpo de un handler de la tabla de acciones del despachador, tal
    cual está en index.html. Una prueba que se escribe su propio handler no
    prueba el que aprieta la gente."""
    txt = src if fuente is None else fuente
    m = re.search(r'"%s": async \(el, e, action, postId\) => \{\n(.*?)\n  \},\n' % re.escape(nombre), txt, re.S)
    if not m: sys.exit("no se encontró el handler " + nombre)
    return m.group(1)
