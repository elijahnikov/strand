import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface FileDropContextValue {
  isDragging: boolean;
  registerHandler: (handler: (files: File[]) => void) => () => void;
}

const FileDropContext = createContext<FileDropContextValue>({
  isDragging: false,
  registerHandler: () => () => {
    //
  },
});

export function FileDropProvider({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const handlerRef = useRef<((files: File[]) => void) | null>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0 && handlerRef.current) {
        handlerRef.current(files);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  const registerHandler = useCallback((handler: (files: File[]) => void) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, []);

  return (
    <FileDropContext.Provider value={{ isDragging, registerHandler }}>
      {children}
    </FileDropContext.Provider>
  );
}

export function useFileDrop() {
  return useContext(FileDropContext);
}

export function useFileDropHandler(handler: (files: File[]) => void) {
  const { registerHandler } = useFileDrop();

  useEffect(() => {
    return registerHandler(handler);
  }, [registerHandler, handler]);
}
