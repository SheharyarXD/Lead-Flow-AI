import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Paperclip, UploadCloud, Trash2, FileText, Download, Loader2 } from "lucide-react";

interface AttachmentsSectionProps {
  leadId?: number;
  customerId?: number;
}

export function AttachmentsSection({ leadId, customerId }: AttachmentsSectionProps) {
  const { organizationId } = useOrganization();
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentsQuery = trpc.document.list.useQuery(
    {
      organizationId: organizationId!,
      leadId,
      customerId,
    },
    { enabled: !!organizationId && (!!leadId || !!customerId) }
  );

  const getPresignedUrlMutation = trpc.document.getPresignedUploadUrl.useMutation();
  const confirmUploadMutation = trpc.document.confirmUpload.useMutation();
  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      utils.document.list.invalidate();
    },
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !organizationId) return;
    const file = files[0];

    setIsUploading(true);
    setUploadProgress(10);
    setErrorMsg(null);

    try {
      // 1. Get presigned upload URL or simulated link from backend
      const presignedRes = await getPresignedUrlMutation.mutateAsync({
        organizationId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(40);

      let finalUrl = presignedRes.publicUrl;

      // 2. If real S3 URL is returned, upload via fetch PUT
      if (presignedRes.uploadUrl) {
        const uploadRes = await fetch(presignedRes.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Failed to upload file to storage bucket");
      } else if (presignedRes.simulated) {
        // Dev fallback: convert file to a local Data URL so download button works immediately
        const reader = new FileReader();
        finalUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setUploadProgress(80);

      // 3. Confirm upload metadata in database
      await confirmUploadMutation.mutateAsync({
        organizationId,
        fileName: file.name,
        url: finalUrl,
        fileSize: file.size,
        mimeType: file.type,
        leadId,
        customerId,
      });

      setUploadProgress(100);
      utils.document.list.invalidate();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (doc: { url: string; fileName: string }) => {
    if (doc.url.includes("storage.leadflowai.com") || doc.url.includes("mock/")) {
      const dummyContent = `LeadFlow AI - Document Preview\n\nFilename: ${doc.fileName}\nUploaded Date: ${new Date().toLocaleDateString()}\n\n[Development Mode]: AWS S3 credentials not set in .env. New uploads will retain local contents.`;
      const blob = new Blob([dummyContent], { type: "text/plain" });
      const blobUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = blobUrl;
      tempLink.download = doc.fileName.endsWith(".txt") ? doc.fileName : `${doc.fileName}.txt`;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(blobUrl);
    } else {
      const tempLink = document.createElement("a");
      tempLink.href = doc.url;
      tempLink.download = doc.fileName;
      tempLink.target = "_blank";
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    }
  };

  return (
    <Card className="bg-white border-zinc-200/80 shadow-sm rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-zinc-950 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-indigo-600" />
            Attachments & Documents
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 mt-0.5">
            Upload contract PDFs, images, or verification files.
          </CardDescription>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 shadow-sm px-3"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <UploadCloud className="w-3.5 h-3.5 mr-1.5" />}
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Progress Indicator */}
        {isUploading && (
          <div className="space-y-1.5 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span>Uploading file to cloud storage...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-150 text-red-800 text-xs font-bold p-3 rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Document List */}
        <div className="space-y-2">
          {documentsQuery.isLoading ? (
            <p className="text-xs text-zinc-400 py-4 text-center">Loading attachments...</p>
          ) : !documentsQuery.data || documentsQuery.data.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-200 hover:border-indigo-400 p-6 rounded-xl text-center cursor-pointer transition-colors group bg-zinc-50/50"
            >
              <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-indigo-600 mx-auto mb-2 transition-colors" />
              <p className="text-xs font-bold text-zinc-700">No documents uploaded yet</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Click here to upload files (PDFs, images, docs)</p>
            </div>
          ) : (
            documentsQuery.data.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-200/80 hover:bg-zinc-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Download document"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: doc.id })}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
