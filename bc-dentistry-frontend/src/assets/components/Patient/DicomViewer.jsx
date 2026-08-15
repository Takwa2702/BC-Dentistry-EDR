import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { authHeaders, databaseUrl } from '../../config/api.js';

export default function DicomViewer({ file, onClose }) {
  const element = useRef(null);
  const [state, setState] = useState({ status: 'loading', message: 'Authorizing and verifying radiographic file…' });
  useEffect(() => {
    const controller = new AbortController(); let objectUrl; let renderingEngine;
    const render = async () => {
      try {
        const response = await axios.get(databaseUrl(`/radiographic-files/${encodeURIComponent(file.fileID)}/content`), { headers: authHeaders(), responseType: 'blob', signal: controller.signal });
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(response.data);
        if (/^image\/(jpeg|png|webp)$/i.test(response.data.type || file.mediaType)) { setState({ status: 'image', objectUrl, message: '' }); return; }
        const [{ RenderingEngine, Enums, init: initializeCore }, { init: initializeLoader }] = await Promise.all([import('@cornerstonejs/core'), import('@cornerstonejs/dicom-image-loader')]);
        await initializeCore(); await initializeLoader();
        if (controller.signal.aborted || !element.current) return;
        const renderingEngineId = `dicom-engine-${file.fileID}`, viewportId = `dicom-viewport-${file.fileID}`;
        renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngine.enableElement({ viewportId, element: element.current, type: Enums.ViewportType.STACK });
        const viewport = renderingEngine.getViewport(viewportId); await viewport.setStack([`wadouri:${objectUrl}`], 0); viewport.render(); setState({ status: 'ready', message: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState({
          status: 'error',
          message: error.response?.data?.error?.message || 'This DICOM file is corrupt or unreadable and cannot be displayed.',
        });
      }
    };
    render();
    return () => { controller.abort(); renderingEngine?.destroy(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.fileID, file.mediaType]);
  return <div role="dialog" aria-modal="true" aria-labelledby="dicom-viewer-title" className="mt-4 rounded border bg-white p-4"><div className="flex items-center justify-between gap-4"><h3 id="dicom-viewer-title" className="text-lg font-semibold">{file.fileName}</h3><button type="button" onClick={onClose}>Close viewer</button></div>{state.status === 'loading' && <p role="status" className="py-4">{state.message}</p>}{state.status === 'error' && <p role="alert" className="py-4 text-red-700">{state.message}</p>}{state.status === 'image' && <img src={state.objectUrl} alt={`Radiographic file ${file.fileName}`} className="mt-4 max-h-[70vh] max-w-full" />}<div ref={element} aria-label={`DICOM image ${file.fileName}`} className={state.status === 'image' || state.status === 'error' ? 'hidden' : 'mt-4 h-[min(70vh,600px)] w-full bg-black'} /></div>;
}
