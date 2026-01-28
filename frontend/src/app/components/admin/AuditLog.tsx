import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { Search, Download, Eye, Calendar } from 'lucide-react';
import { mockAuditLogs, type AuditLog } from '@/app/utils/mockData';
import { toast } from 'sonner';

export function AuditLogComponent() {
  const [logs] = useState<AuditLog[]>(mockAuditLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResult = filterResult === 'all' || log.result === filterResult;

    return matchesSearch && matchesAction && matchesResult;
  });

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));

  const handleExport = () => {
    const csv = [
      ['时间', '操作员', '角色', '操作', '目标类型', '目标名称', 'IP地址', '结果'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.operator,
        log.operatorRole,
        log.action,
        log.targetType,
        log.targetName,
        log.ip,
        log.result
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-logs.csv';
    link.click();
    toast.success('审计日志导出成功');
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
          <p className="text-sm text-muted-foreground mt-1">
            查看系统操作记录，共 {logs.length} 条日志
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          导出日志
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索操作员、目标名称、操作..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="筛选操作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>{action}</SelectItem>
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
              <TableHead>目标类型</TableHead>
              <TableHead>目标名称</TableHead>
              <TableHead>IP地址</TableHead>
              <TableHead>结果</TableHead>
              <TableHead className="text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  未找到日志
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                  <TableCell>{log.operator}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.operatorRole}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.targetType}</TableCell>
                  <TableCell>{log.targetName}</TableCell>
                  <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                  <TableCell>
                    <Badge variant={log.result === 'success' ? 'default' : 'destructive'}>
                      {log.result === 'success' ? '成功' : '失败'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => viewDetails(log)}
                    >
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
                    <span className="col-span-2 text-sm font-mono">{selectedLog.timestamp}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">操作员:</span>
                    <span className="col-span-2 text-sm">{selectedLog.operator}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">角色:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant="outline">{selectedLog.operatorRole}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">操作:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant="secondary">{selectedLog.action}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">目标类型:</span>
                    <span className="col-span-2 text-sm">{selectedLog.targetType}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">目标名称:</span>
                    <span className="col-span-2 text-sm">{selectedLog.targetName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">IP地址:</span>
                    <span className="col-span-2 text-sm font-mono">{selectedLog.ip}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-muted-foreground">结果:</span>
                    <span className="col-span-2 text-sm">
                      <Badge variant={selectedLog.result === 'success' ? 'default' : 'destructive'}>
                        {selectedLog.result === 'success' ? '成功' : '失败'}
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
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    无变更详情
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
