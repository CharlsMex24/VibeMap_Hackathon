import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
function App() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState(null);
    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file)
            return;
        setFileName(file.name);
        setLoading(true);
        setError(null);
        setResult(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error('Falló el análisis del archivo');
            }
            const data = await response.json();
            setResult(data.result);
        }
        catch (err) {
            setError(err.message || 'Ocurrió un error inesperado');
        }
        finally {
            setLoading(false);
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
    });
    return (_jsxs("div", { className: "max-w-5xl mx-auto px-4 py-12 font-sans", children: [_jsxs("header", { className: "text-center mb-16", children: [_jsx("h1", { className: "text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent", children: "VibeMAP" }), _jsx("p", { className: "text-xl text-slate-600 max-w-2xl mx-auto", children: "Motor de ingenier\u00EDa inversa visual. Sube tu c\u00F3digo y obt\u00E9n un mapa mental de ingenier\u00EDa instant\u00E1neo." })] }), _jsxs("main", { className: "space-y-12", children: [_jsxs("section", { ...getRootProps(), className: `
            border-4 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer
            ${isDragActive
                            ? 'border-purple-500 bg-purple-50 scale-[1.02]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xl'}
          `, children: [_jsx("input", { ...getInputProps() }), _jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-10 w-10", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }) }), fileName ? (_jsxs("p", { className: "text-2xl font-semibold text-slate-800", children: ["Archivo seleccionado: ", _jsx("span", { className: "text-purple-600", children: fileName })] })) : (_jsx("p", { className: "text-2xl font-semibold text-slate-800", children: "Suelta tu archivo aqu\u00ED o haz clic para subir" })), _jsx("p", { className: "text-slate-500 text-lg", children: "Soporta .js, .ts, .py, .go, .java y m\u00E1s" })] })] }), loading && (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 space-y-4", children: [_jsx("div", { className: "w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" }), _jsx("p", { className: "text-xl font-medium text-purple-600 animate-pulse", children: "VibeMAP est\u00E1 mapeando el c\u00F3digo..." })] })), error && (_jsx("div", { className: "bg-red-50 border-l-8 border-red-500 p-6 rounded-xl", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "h-6 w-6 text-red-500 mr-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsx("p", { className: "text-lg font-bold text-red-800", children: error })] }) })), result && (_jsxs("div", { className: "bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-700", children: [_jsxs("div", { className: "bg-slate-900 px-8 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex space-x-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-red-500" }), _jsx("div", { className: "w-3 h-3 rounded-full bg-yellow-500" }), _jsx("div", { className: "w-3 h-3 rounded-full bg-green-500" })] }), _jsx("span", { className: "text-slate-400 text-sm font-mono tracking-widest uppercase", children: "Reverse Engineering Output" })] }), _jsx("div", { className: "p-10 prose prose-slate max-w-none prose-headings:text-purple-700 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200", children: _jsx(ReactMarkdown, { children: result }) })] }))] }), _jsx("footer", { className: "mt-24 text-center text-slate-400 pb-12", children: _jsx("p", { children: "\u00A9 2026 VibeMAP Engine. Dise\u00F1ado para arquitectos visuales." }) })] }));
}
export default App;
//# sourceMappingURL=App.js.map