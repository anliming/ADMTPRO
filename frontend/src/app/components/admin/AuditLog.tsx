import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { Search, Download, Eye, Calendar, RefreshCw } from 'lucide-react';
import { auditApi, type AuditLog } from '@/app/utils/api';
import { toast } from 'sonner';

export function AuditLogComponent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params: { actor?: string; action?: string; result?: string; target?: string; limit?: number } = {
        limit: 100,
      };
      if (actor.trim()) params.actor = actor.trim();
      if (target.trim()) params.target = target.trim();
      if (filterAction !== 'all') params.action = filterAction;
      if (filterResult === 'success') params.result = 'ok';
      if (filterResult === 'failed') params.result = 'error';
      const res = await auditApi.list(params);
      setLogs(res.items || []);
    } catch (err: any) {
      toast.error(err.message || '加载审计日志失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))), [logs]);

  const handleExport = async () => {
    try {
      const csv = await auditApi.export({ limit: 1000 });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'audit-logs.csv';
      link.click();
      toast.success('审计日志导出成功');
    } catch (err: any) {
      toast.error(err.message || '导出失败');
    }
  };

  const viewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">审计日志</h2>
          <p className="text-sm text-muted-foreground mt-1">查看系统操作记录，共 {logs.length} 条日志</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出日志
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="操作员"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex-1 relative">
          <Input
            placeholder="目标"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="筛选操作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="结果" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadLogs}>
          <Search className="w-4 h-4 mr-2" />
          查询
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>操作员</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>结果</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  正在加载...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  未找到日志
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">{log.created_at}</TableCell>
                  <TableCell>{log.actor}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.actor_role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.target}</TableCell>
                  <TableCell>
                    <Badge variant={log.result === 'ok' ? 'default' : 'destructive'}>
                      {log.result === 'ok' ? '成功' : '失败'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => viewDetails(log)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>审计日志详情</DialogTitle>
            <DialogDescription>查看操作的详细信息和变更内容</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">时间:</span>
                    <span className="col-span-2 text-sm font-mono">{selectedLog.created_at}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">操作员:</span>
                    <span className="col-span-2 text-sm">{selectedLog.actor}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">角色:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant="outline">{selectedLog.actor_role}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">操作:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant="secondary">{selectedLog.action}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">目标:</span>
                    <span className="col-span-2 text-sm">{selectedLog.target}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">结果:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant={selectedLog.result === 'ok' ? 'default' : 'destructive'}>
                        {selectedLog.result === 'ok' ? '成功' : '失败'}
                      </Badge>
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                {selectedLog.before && (
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        变更前 (Before)
                      </h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                        {JSON.stringify(selectedLog.before, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {selectedLog.after && (
                  <Card>
                    <CardContent className="pt-6">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        变更后 (After)
                      </h4>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                        {JSON.stringify(selectedLog.after, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>

              {!selectedLog.before && !selectedLog.after && (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">无变更详情</CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
